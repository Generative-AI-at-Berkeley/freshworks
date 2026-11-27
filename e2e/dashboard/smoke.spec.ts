import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Every page in apps/dashboard/src/app, in mock mode. IDs come from the mock
 * org in apps/dashboard/src/mock. A new page fails the coverage check until
 * it gets a row here.
 */
const PAGES: { route: string; path: string; heading: string }[] = [
  { route: '/', path: '/', heading: 'Skill adoption' },
  { route: '/skills', path: '/skills', heading: 'Skill adoption' },
  { route: '/skills/[skillId]', path: '/skills/code-review', heading: 'code-review' },
  { route: '/leaders', path: '/leaders', heading: 'Avery Stone' },
  { route: '/leaders/[managerId]', path: '/leaders/e-110', heading: 'Jordan Hale' },
  { route: '/engineers/[engineerId]', path: '/engineers/e-111', heading: 'Casey Moreau' },
  { route: '/org', path: '/org', heading: 'Engineering' },
  { route: '/org/[orgUnitId]', path: '/org/org-platform', heading: 'Platform' },
  { route: '/practice', path: '/practice', heading: 'Practice health' },
  { route: '/me', path: '/me', heading: 'My data' },
  { route: '/admin/fleet', path: '/admin/fleet', heading: 'Fleet health' },
  { route: '/admin/access-log', path: '/admin/access-log', heading: 'Access log' },
];

const appDir = join(import.meta.dirname, '..', '..', 'apps', 'dashboard', 'src', 'app');

function pageRoutes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'api' ? [] : pageRoutes(full);
    if (entry.name !== 'page.tsx') return [];
    const route = relative(appDir, dir).split(sep).join('/');
    return [`/${route}`];
  });
}

test('every page in src/app has a smoke row', () => {
  expect(pageRoutes(appDir).sort()).toEqual(PAGES.map((p) => p.route).sort());
});

for (const { path, heading } of PAGES) {
  test(`${path} renders in mock mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
