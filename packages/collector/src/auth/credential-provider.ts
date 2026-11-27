/**
 * Supplies the bearer token for uploads.
 *
 * The real flow belongs to the existing Freshworks pipeline and the collector
 * reuses it, with no sign-in of its own:
 *   1. Jamf installs a one-time registration credential with the package.
 *   2. On first run the device registers with the telemetry backend.
 *   3. The backend issues a device credential that rotates. Every upload is
 *      signed with the current one, and the backend maps it to engineer and
 *      device.
 *
 * Open question: the credential is described as rotating daily, but the
 * daemon_heartbeat example implies a longer lifetime. Read the expiry from
 * the credential itself and never hard-code one.
 */
export interface DeviceCredential {
  token: string;
  expiresAt: Date;
}

export interface CredentialProvider {
  /** Returns a valid credential, rotating first if the current one is close to expiry. */
  current(): Promise<DeviceCredential>;
  /** Called after a 401, so the next call fetches a fresh credential. */
  invalidate(): Promise<void>;
}

/**
 * Fixed token for local development against services/ingest-mock.
 *
 * TODO(AG-1): JamfCredentialProvider, which registers with the mock's
 * /v1/devices/register using the provisioned registration credential and
 * stores the rotating credential in stateDir with mode 0600.
 */
export class StaticCredentialProvider implements CredentialProvider {
  constructor(private readonly token: string) {}

  current(): Promise<DeviceCredential> {
    return Promise.resolve({ token: this.token, expiresAt: new Date(8.64e15) });
  }

  invalidate(): Promise<void> {
    return Promise.resolve();
  }
}
