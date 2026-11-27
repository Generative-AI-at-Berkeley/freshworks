/**
 * The page CSP, built per request around a fresh nonce (src/proxy.ts).
 *
 * - Scripts: Next's runtime and the theme init script carry the nonce.
 *   'strict-dynamic' lets the chunks they load run without listing each one.
 * - Style elements: same-origin files, plus nonced inline ones.
 * - Style attributes: 'unsafe-inline'. React renders `style={...}` (chart bar
 *   widths, tooltip position) as attributes, and a nonce cannot cover an
 *   attribute. Attribute CSS cannot run script, so this is the narrow gap.
 * - Fonts: Dew's fonts.css inlines them as data: URIs.
 *
 * `next dev` also needs 'unsafe-eval' (React dev tooling) and inline styles
 * for hot reload. Never in production.
 */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    'style-src-elem': ["'self'", dev ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}
