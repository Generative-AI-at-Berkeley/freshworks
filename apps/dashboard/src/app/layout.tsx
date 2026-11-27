import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import '@freshworks/dew-styles/colors.css';
import '@freshworks/dew-styles/numbers.css';
import '@freshworks/dew-components/assets/dew-cmp-reset.css';
import '@freshworks/dew-components/assets/dew-cmp-lib.css';
import './globals.css';

import { AppShell } from '@/components/layout/app-shell';
import { APP_NAME } from '@/config/constants';
import { DEW_THEME_CLASS, Theme } from '@/config/enums';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

import { Providers } from './providers';

// Every view reads the period from the URL and the viewer from the session,
// so nothing here is worth prerendering. Rendering per request also means the
// server and the browser hydrate the same tree in one pass.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'How engineering teams use AI coding tools, and which skills are catching on.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set per request by src/proxy.ts. The CSP blocks this inline script without it.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // The init script swaps the theme class before React hydrates, on purpose,
    // so a dark-mode visitor never sees a light flash. This attribute tells
    // React that one mismatch on <html> is expected. It does not cover children.
    <html lang="en" className={DEW_THEME_CLASS[Theme.Light]} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Static on purpose: the bundler cannot parse this file. See scripts/copy-dew-fonts.mjs. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/dew/fonts.css" />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
