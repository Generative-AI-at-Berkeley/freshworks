import { z } from 'zod';

/**
 * Placeholder for event types whose `data` is not modelled yet. It accepts any
 * object so ingestion does not reject real traffic while X-1 is in progress.
 * Do not add new uses. Each one is a gap in validation.
 */
export const unmodelledData = z.record(z.string(), z.unknown());
