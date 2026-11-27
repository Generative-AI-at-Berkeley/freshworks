import { z } from 'zod';

// sessionStart carries everything in the shared blocks and nothing in `data`.
export const SessionStartData = z.object({}).strict();
