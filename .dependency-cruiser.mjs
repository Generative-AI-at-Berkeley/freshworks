// Workspace boundaries from docs/decisions/0008-repo-layout.md. Run with: pnpm lint:deps
const TESTS = '(\\.test\\.tsx?$|^e2e/|^packages/testkit/)';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'contracts-standalone',
      comment:
        'packages/contracts is shared by both teams. It imports no other workspace, so a contract change never drags in collector or backend code.',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: '^(apps|services|e2e)/|^packages/(?!contracts/)' },
    },
    {
      name: 'dashboard-only-contracts',
      comment:
        'The dashboard talks to the backend over HTTP and parses with contracts. It never imports a service or the collector.',
      severity: 'error',
      from: { path: '^apps/dashboard/' },
      to: { path: '^(services|e2e)/|^packages/collector/' },
    },
    {
      name: 'collector-not-services',
      comment:
        'The collector runs on engineer laptops and only knows the wire format. Backend code stays out of it.',
      severity: 'error',
      from: { path: '^packages/collector/' },
      to: { path: '^(services|apps)/' },
    },
    {
      name: 'services-not-apps',
      comment: 'Services serve the dashboard. They never import it.',
      severity: 'error',
      from: { path: '^services/' },
      to: { path: '^apps/' },
    },
    {
      name: 'testkit-only-in-tests',
      comment: 'packages/testkit is synthetic data for tests. Shipped code must not depend on it.',
      severity: 'error',
      from: { pathNot: TESTS },
      to: { path: '^packages/testkit/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'An import the cruiser cannot resolve is an import it cannot check.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|\\.next|node_modules)/' },
    tsPreCompilationDeps: true,
    // The dashboard's tsconfig carries the only path alias (`@/`). The other
    // packages have none, so this one file is enough to resolve every import.
    tsConfig: { fileName: 'apps/dashboard/tsconfig.json' },
    enhancedResolveOptions: {
      // Same condition as tsconfig.base.json, so workspace imports land on src/.
      conditionNames: ['@fwcoach/source', 'import', 'require', 'node', 'default', 'types'],
      exportsFields: ['exports'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json', '.d.ts'],
    },
  },
};
