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
      include: ['packages/*/src/**', 'services/*/src/**'],
      exclude: ['**/*.test.ts', '**/main.ts'],
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
