# Lost or rotated device credential

Each device uploads with a rotating credential. Jamf pushes a one-time
registration credential, and the collector exchanges it for a device ID and
the first rotating credential ([docs/contracts/ingest.md](../contracts/ingest.md)).

**Never handle the credential itself.** Do not ask an engineer to paste it,
and do not copy it into a ticket or chat. The backend stores hashes only. Logs
carry the device ID, never the token.

## Status

| Piece                                                        | Today                                                                           | Ticket |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------ |
| `device_credential` table                                    | Not migrated yet                                                                | BE-1   |
| ingest-mock `/v1/devices/register`, `/v1/devices/credential` | Answer 501                                                                      | BE-1   |
| Credential check on `/v1/logs`                               | Any bearer token is accepted. The device ID is `dev_` plus a hash of the token. | BE-1   |
| Collector Jamf flow (`JamfCredentialProvider`)               | Not built                                                                       | AG-1   |

So locally, a new token is just a new device ID. The procedures below are
what BE-1 and AG-1 build to.

## The table

`device_credential`: `device_id`, `credential_sha256`, `issued_at`,
`expires_at`, `revoked_at`. See [docs/data-model.md](../data-model.md).

Two rows for one device overlap briefly during rotation, so a laptop that
slept through a rotation is not locked out. A credential is valid when it
matches a row with `revoked_at` null and `expires_at` in the future.

## Lost or stolen laptop

1. Get the device ID from the engineer's device record, never from the
   credential.
2. Revoke every live credential for it. Planned, BE-1. Run as the owner.

   ```sql
   update app.device_credential
   set revoked_at = now()
   where device_id = $1 and revoked_at is null;
   ```

3. Uploads from that device now get 401. The collector refreshes once, then
   stops and reports.
4. The replacement laptop enrolls through Jamf and gets a new device ID.

Events already stored from the old device stay.

## Rotation failed or a laptop slept too long

Symptom: one device gets 401 on every upload and its collector has stopped.

1. Check its rows. A device with only expired or revoked rows cannot rotate.

   ```sql
   select issued_at, expires_at, revoked_at
   from app.device_credential
   where device_id = $1
   order by issued_at desc;
   ```

2. Re-push the registration credential from Jamf (AG-1). The collector
   registers again and gets a fresh credential.
3. Its buffered events upload once it is back. They keep their `msg_id`, so
   nothing is counted twice.

The credential lifetime is still an open question for Freshworks
([ingest.md](../contracts/ingest.md), question 1). The collector reads expiry
from the credential and assumes neither answer.

## Every device at once

Suspect the receiver, not the devices. Locally, read the ingest-mock logs. In
production the pipeline belongs to Freshworks, so raise it with them before
revoking anything.
