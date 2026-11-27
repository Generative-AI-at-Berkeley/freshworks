import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from '@/lib/csp';

const directives = (csp: string) =>
  new Map(csp.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)] as const));

describe('contentSecurityPolicy', () => {
  it('allows only nonced scripts in production, and no eval', () => {
    const csp = directives(contentSecurityPolicy('abc', false));
    expect(csp.get('script-src')).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
    expect(csp.get('style-src-elem')).toEqual(["'self'", "'nonce-abc'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
  });

  it('loosens only what next dev needs', () => {
    const csp = directives(contentSecurityPolicy('abc', true));
    expect(csp.get('script-src')).toContain("'unsafe-eval'");
    expect(csp.get('style-src-elem')).toContain("'unsafe-inline'");
  });
});
