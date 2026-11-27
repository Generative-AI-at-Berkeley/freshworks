import { describe, expect, it } from 'vitest';

import { parseError } from '@/lib/api-client';

describe('parseError', () => {
  it('uses the problem detail from the API', () => {
    const error = parseError(
      '{"status":403,"detail":"Not your report."}',
      403,
      '/v1/engineers/e-1',
    );
    expect(error.message).toBe('Not your report.');
    expect(error.status).toBe(403);
  });

  it('falls back to a sentence for a body that is not a problem', () => {
    expect(parseError('<html>', 502, '/v1/x').message).toBe(
      'Request to /v1/x failed with status 502.',
    );
  });
});
