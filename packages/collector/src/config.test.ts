import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const minimal = { FWCOACH_INGEST_URL: 'http://localhost:4318', FWCOACH_STATE_DIR: '/tmp/x' };

describe('loadConfig', () => {
  it('defaults to the pipeline cadence and L1', () => {
    const config = loadConfig(minimal);
    expect(config.flushIntervalSeconds).toBe(300);
    expect(config.contentLevel).toBe('L1');
  });

  it('never defaults to L2', () => {
    expect(loadConfig(minimal).contentLevel).not.toBe('L2');
  });

  it('refuses L2 until it is built and reviewed', () => {
    expect(() => loadConfig({ ...minimal, FWCOACH_CONTENT_LEVEL: 'L2' })).toThrow(/FWCOACH_/);
  });

  it('fails with the variable name when something is missing', () => {
    expect(() => loadConfig({})).toThrow(/FWCOACH_/);
  });
});
