#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { encodeBatch } from '@fwcoach/contracts';

import { defaultAdapters } from './adapters/registry.js';
import { MemoryBuffer } from './buffer/memory-buffer.js';
import { loadConfig } from './config.js';
import { collectOnce, flushOnce, runDaemon, type DaemonDeps } from './daemon.js';
import { createLogger } from './logger.js';
import { HttpUploader } from './upload/uploader.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const usage = `fwcoach ${version}

Usage:
  fwcoach run              Collect and upload every flush interval until stopped.
  fwcoach run --once       One collection pass and one upload, then exit.
  fwcoach run --dry-run    One collection pass. Prints the exact OTLP request that
                           would be sent, and sends nothing.
  fwcoach status           Show which harnesses were found and any warnings.
  fwcoach --version
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      once: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.version) return print(version);
  const command = positionals[0];
  if (values.help || command === undefined) return print(usage);

  const adapters = defaultAdapters();

  if (command === 'status') {
    for (const adapter of adapters) {
      const result = await adapter.detect();
      const found = result.installed ? `found (${result.formats.join(', ')})` : 'not found';
      print(`${adapter.harness}: ${found} ${result.warnings.join('; ')}`.trimEnd());
    }
    return 0;
  }

  if (command !== 'run') {
    print(usage);
    return 2;
  }

  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const deps: DaemonDeps = {
    config,
    adapters,
    // TODO(AG-1): DiskBuffer for the real daemon. MemoryBuffer loses data on exit.
    buffer: new MemoryBuffer(config.bufferMaxBytes),
    // TODO(AG-1): pass a CredentialProvider (Jamf flow, or config.devToken
    // against ingest-mock). There is deliberately no fallback token.
    uploader: new HttpUploader(config.ingestUrl),
    logger,
    agentVersion: version,
    // TODO(AG-1): the device ID comes from registration, not a constant.
    deviceId: 'dev_LOCAL',
  };

  const controller = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sig, () => {
      controller.abort();
    });
  }

  if (values['dry-run']) {
    await collectOnce(deps, controller.signal);
    const events = await deps.buffer.peek({
      maxEvents: Number.MAX_SAFE_INTEGER,
      maxBytes: Number.MAX_SAFE_INTEGER,
    });
    print(JSON.stringify(encodeBatch(events, { agentVersion: version }), null, 2));
    return 0;
  }

  if (values.once) {
    await collectOnce(deps, controller.signal);
    await flushOnce(deps);
    return 0;
  }

  await runDaemon(deps, controller.signal);
  return 0;
}

// The CLI's own output is the product here, so it bypasses the logger.
function print(text: string): number {
  process.stdout.write(`${text}\n`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`fwcoach: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
