import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next writes its own AGENTS.md and CLAUDE.md here on every dev run. The
  // rules for this repo live in the root AGENTS.md. Turn the generator off.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
