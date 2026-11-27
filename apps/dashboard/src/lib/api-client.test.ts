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

  it('adds the request ID so the error can be traced in the API logs', () => {
    const error = parseError(
      '{"status":500,"detail":"The API failed on this request.","requestId":"0b6a3d4e-1111"}',
      500,
      '/v1/me/data',
    );
    expect(error.message).toBe('The API failed on this request. Request ID 0b6a3d4e-1111.');
  });

  it('falls back to a sentence for a body that is not a problem', () => {
    expect(parseError('<html>', 502, '/v1/x').message).toBe(
      'Request to /v1/x failed with status 502.',
    );
  });
});
