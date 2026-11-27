import { api } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import {
  ContractError,
  parseAny,
  parseContract,
  parseProblem,
  type ResponseLike,
} from './contract.js';

const res = (statusCode: number, type: string, body: unknown): ResponseLike => ({
  statusCode,
  headers: { 'content-type': type },
  json: () => body,
});

describe('contract helpers', () => {
  it('parses a 2xx body with the route schema', () => {
    const range = { from: '2026-11-01', to: '2026-11-08' };
    expect(parseContract(api.Range, res(200, 'application/json; charset=utf-8', range))).toEqual(
      range,
    );
  });

  it('fails on a field the schema does not have', () => {
    const body = { from: '2026-11-01', to: '2026-11-08', extra: 1 };
    expect(() => parseContract(api.Range, res(200, 'application/json', body))).toThrow(
      ContractError,
    );
  });

  it('requires problem+json with a matching status for errors', () => {
    const body = { status: 403, detail: 'No access.' };
    expect(parseProblem(res(403, 'application/problem+json', body))).toEqual(body);
    expect(() => parseProblem(res(404, 'application/problem+json', body))).toThrow(ContractError);
    expect(() => parseProblem(res(403, 'application/json', body))).toThrow(ContractError);
  });

  it('routes a response to the schema or the problem check by status', () => {
    const problem = parseAny(
      api.Range,
      res(501, 'application/problem+json', { status: 501, detail: 'x' }),
    );
    expect(problem.ok).toBe(false);
  });
});
