import { describe, expect, it } from 'vitest';

import { problem, Problem } from './common.js';

describe('problem', () => {
  it('builds an RFC 9457 body that the Problem schema accepts', () => {
    const body = problem(404, 'No such engineer.');
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No such engineer.',
    });
    expect(Problem.parse(body)).toEqual(body);
  });

  it('carries the request id when one is given', () => {
    const body = problem(500, 'Server error.', 'req-1');
    expect(body.requestId).toBe('req-1');
    expect(Problem.parse(body)).toEqual(body);
    expect('requestId' in problem(500, 'Server error.')).toBe(false);
  });

  it('falls back to a generic title for a status it has no phrase for', () => {
    expect(problem(418, 'x').title).toBe('Client Error');
    expect(problem(599, 'x').title).toBe('Server Error');
  });

  it('still parses a body with only status and detail', () => {
    expect(Problem.parse({ status: 403, detail: 'No access.' })).toEqual({
      status: 403,
      detail: 'No access.',
    });
  });
});
