// Dew's fonts.css has an @font-feature-values block with selectors inside it.
// Browsers skip that block, but the bundler's CSS parser rejects the whole
// file. So the browser loads it as a plain static stylesheet instead, copied
// unchanged from the installed package. public/dew/ is generated, not committed.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = require.resolve('@freshworks/dew-styles/fonts.css');
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'dew', 'fonts.css');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
