import { defineConfig } from 'vitest/config';

// Must match the condition in tsconfig.base.json so tests import workspace
// packages from src/ instead of a stale dist/. The trailing entries are Vite's
// default server conditions, repeated here because setting the option replaces them.
const conditions = ['@fwcoach/source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: conditions } },
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'services/*/src/**', 'apps/*/src/**'],
      exclude: ['**/*.test.ts', '**/main.ts'],
      // Floors set just under the measured numbers (44.27, 37.48, 30.63, 44.88)
      // so coverage cannot quietly drop. Raise them as tickets land tests.
      thresholds: {
        statements: 44,
        branches: 37,
        functions: 30,
        lines: 44,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'services/*/src/**/*.test.ts'],
          exclude: ['**/*.int.test.ts'],
        },
      },
      {
        // The dashboard's server and data code. Same conditions, plus its `@/` alias.
        // `server-only` throws outside Next's server bundle, so tests get a stub.
        extends: true,
        resolve: {
          alias: {
            '@/': new URL('./apps/dashboard/src/', import.meta.url).pathname,
            'server-only': new URL('./apps/dashboard/test/server-only-stub.ts', import.meta.url)
              .pathname,
          },
        },
        test: {
          name: 'dashboard',
          include: ['apps/dashboard/src/**/*.test.ts'],
        },
      },
      {
        // Needs DATABASE_URL pointing at a migrated Postgres. CI runs these in the db job.
        extends: true,
        test: {
          name: 'integration',
          include: ['**/src/**/*.int.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
      {
        // Needs the docker compose stack. See e2e/README.md.
        extends: true,
        test: {
          name: 'e2e',
          include: ['e2e/**/*.e2e.test.ts'],
          testTimeout: 120_000,
        },
      },
    ],
  },
});
