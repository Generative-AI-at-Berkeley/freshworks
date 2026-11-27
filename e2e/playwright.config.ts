import { defineConfig, devices } from '@playwright/test';

// Off the dev port, so a running `pnpm dev:dashboard` is never mistaken for the build under test.
const port = Number(process.env['SMOKE_PORT'] ?? 3100);

/**
 * Dashboard smoke test in mock mode. Build first: `pnpm --filter
 * @fwcoach/dashboard... build`, then `pnpm --filter @fwcoach/e2e test:dashboard`.
 * Vitest never picks these up: its e2e project only matches *.e2e.test.ts.
 */
export default defineConfig({
  testDir: './dashboard',
  testMatch: '**/*.spec.ts',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm --filter @fwcoach/dashboard exec next start --port ${port}`,
    url: `http://localhost:${port}/api/session`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
    // Blank API settings put the dashboard in mock mode (apps/dashboard/src/config/server.ts).
    env: { API_BASE_URL: '', DASHBOARD_DEV_ENGINEER: '', DASHBOARD_DEV_ORG_UNIT: '' },
  },
});
