// @ts-check
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// AGENTS.md: config comes from one Zod-validated config file per package. Kept as
// constants because a later block that sets the same rule replaces it, so blocks
// that add their own restrictions repeat these.
const noProcessEnv = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: 'Read the environment only in config.ts. Add the variable to its Zod schema.',
};
const noEnvImport = {
  name: 'node:process',
  importNames: ['env'],
  message: 'Read the environment only in config.ts. Add the variable to its Zod schema.',
};
const colorMessage = 'Use a Dew CSS variable, for example var(--color-text-primary).';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/dashboard/.next/**',
      'apps/dashboard/public/dew/**',
      'apps/dashboard/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unhandled promises are how a collector silently drops a batch.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // console output from the collector can end up in a user's terminal or a
      // launchd log. Use the logger so redaction and levels apply.
      'no-console': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.e2e.test.ts', 'packages/testkit/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Tests and e2e tooling may read the environment to decide whether and
    // where to run, as db.int.test.ts and the Playwright config do.
    ignores: ['**/config.ts', 'apps/dashboard/src/config/server.ts', '**/*.test.ts', 'e2e/**'],
    rules: {
      'no-restricted-syntax': ['error', noProcessEnv],
      'no-restricted-imports': ['error', { paths: [noEnvImport] }],
    },
  },
  {
    // Scripts and tests print to the terminal on purpose. Shipped code uses the logger.
    files: ['scripts/**', '**/scripts/**', '**/*.test.ts', '**/*.e2e.test.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // AGENTS.md: event IDs come from eventId() over stable source facts. A random
    // ID breaks idempotency, so a re-read session would land twice.
    files: ['packages/collector/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            noEnvImport,
            {
              name: 'node:crypto',
              importNames: ['randomUUID'],
              message: 'Use eventId() from @fwcoach/contracts.',
            },
            {
              name: 'crypto',
              importNames: ['randomUUID'],
              message: 'Use eventId() from @fwcoach/contracts.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { property: 'randomUUID', message: 'Use eventId() from @fwcoach/contracts.' },
      ],
    },
  },
  {
    // The dashboard runs in the browser and on Next's server. It gets React and
    // Next rules on top of the shared strict TypeScript set.
    files: ['apps/dashboard/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/dashboard' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    // AGENTS.md: Dew CSS variables only, no hardcoded colors. The logo SVG is
    // Freshworks brand artwork and keeps its own fills.
    files: ['apps/dashboard/**/*.tsx'],
    ignores: ['apps/dashboard/src/components/layout/freshworks-logo.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        noProcessEnv,
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b|\\b(rgb|hsl)a?\\(/]',
          message: colorMessage,
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b|\\b(rgb|hsl)a?\\(/]',
          message: colorMessage,
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
