import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleShutdown } from './shutdown.js';

class FakeProcess extends EventEmitter {
  exit = vi.fn();
}

function setup(close: () => Promise<void> = () => Promise.resolve()) {
  const proc = new FakeProcess();
  const log = { info: vi.fn(), error: vi.fn(), fatal: vi.fn() };
  const cleanup = vi.fn(() => Promise.resolve());
  const app = { close: vi.fn(close), log } as never;
  const metricsApp = { close: vi.fn(() => Promise.resolve()) };
  handleShutdown({ app, metricsApp: metricsApp as never, cleanup, deadlineMs: 1000, proc });
  return { proc, log, cleanup, metricsApp };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('handleShutdown', () => {
  it('drains, runs cleanup and exits 0 on SIGTERM', async () => {
    const { proc, cleanup, metricsApp } = setup();
    proc.emit('SIGTERM');
    await vi.waitFor(() => {
      expect(proc.exit).toHaveBeenCalledWith(0);
    });
    expect(cleanup).toHaveBeenCalledOnce();
    expect(metricsApp.close).toHaveBeenCalledOnce();
  });

  it('exits 1 when close hangs past the deadline', async () => {
    vi.useFakeTimers();
    const { proc, cleanup } = setup(() => new Promise(() => {}));
    proc.emit('SIGINT');
    await vi.advanceTimersByTimeAsync(1000);
    expect(proc.exit).toHaveBeenCalledWith(1);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('logs and exits 1 on an unhandled rejection', async () => {
    const { proc, log, cleanup } = setup();
    proc.emit('unhandledRejection', new Error('lost'));
    await vi.waitFor(() => {
      expect(proc.exit).toHaveBeenCalledWith(1);
    });
    expect(log.fatal).toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('logs and exits 1 on an uncaught exception', async () => {
    const { proc, log } = setup();
    proc.emit('uncaughtException', new Error('boom'));
    await vi.waitFor(() => {
      expect(proc.exit).toHaveBeenCalledWith(1);
    });
    expect(log.fatal).toHaveBeenCalled();
  });

  it('shuts down once when signals repeat', async () => {
    const { proc, cleanup } = setup();
    proc.emit('SIGTERM');
    proc.emit('unhandledRejection', new Error('late'));
    await vi.waitFor(() => {
      expect(proc.exit).toHaveBeenCalledWith(0);
    });
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
