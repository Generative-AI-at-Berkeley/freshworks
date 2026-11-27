import { z } from 'zod';

import { ServerMode } from '@/config/enums';

/**
 * Who the dashboard is acting as. Served by this app (src/app/api/session),
 * not the API: today it comes from the dev identity in config. With OIDC it
 * will come from the token and `/v1/me/data` (TODO(X-3), after BE-2).
 */
export const Session = z.strictObject({
  mode: z.enum([ServerMode.Mock, ServerMode.Api]),
  engineerId: z.string(),
  orgUnitId: z.string(),
  /** Display names when the dashboard knows them. Null shows the id instead. */
  displayName: z.string().nullable(),
  orgUnitName: z.string().nullable(),
});
export type Session = z.infer<typeof Session>;
