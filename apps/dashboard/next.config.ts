import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next writes its own AGENTS.md and CLAUDE.md here on every dev run. The
  // rules for this repo live in the root AGENTS.md. Turn the generator off.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev badge sits bottom-left by default, over the sidebar's theme toggle.
  devIndicators: { position: 'bottom-right' },
  // The container (apps/dashboard/Dockerfile) runs .next/standalone/server.js.
  // Tracing starts at the repo root so workspace packages are copied too.
  // `next start` still works, with a warning.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
};

export default nextConfig;
