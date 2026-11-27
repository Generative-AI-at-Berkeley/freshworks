import type { FastifyInstance } from 'fastify';

interface ProcessLike {
  on(event: 'unhandledRejection' | 'uncaughtException', listener: (err: unknown) => void): unknown;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  exit(code: number): void;
}

export interface ShutdownOptions {
  app: Pick<FastifyInstance, 'close' | 'log'>;
  /** The /metrics listener. Closed with the app so the process can exit. */
  metricsApp?: Pick<FastifyInstance, 'close'>;
  /** Runs after the server stops taking requests, for example closing the pool. */
  cleanup?: () => Promise<void>;
  deadlineMs: number;
  /** The process. Tests pass a stand-in. */
  proc?: ProcessLike;
}

/**
 * SIGTERM and SIGINT drain in-flight requests, then exit 0. A crash
 * (unhandled rejection, uncaught exception) logs and exits 1, because the
 * process state is no longer trusted. Either way the deadline forces an exit,
 * so a hung request or a stuck pool cannot hold a terminating container past
 * its grace period.
 */
export function handleShutdown({
  app,
  metricsApp,
  cleanup,
  deadlineMs,
  proc = process,
}: ShutdownOptions) {
  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => {
      app.log.error({ deadlineMs }, 'shutdown took too long, exiting');
      proc.exit(1);
    }, deadlineMs);
    timer.unref();
    try {
      await Promise.all([app.close(), metricsApp?.close()]);
      await cleanup?.();
      proc.exit(code);
    } catch (err) {
      app.log.error({ err }, 'shutdown failed');
      proc.exit(1);
    } finally {
      clearTimeout(timer);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    proc.once(signal, () => {
      app.log.info({ signal }, 'shutting down');
      void stop(0);
    });
  }
  proc.on('unhandledRejection', (err) => {
    app.log.fatal({ err }, 'unhandled rejection');
    void stop(1);
  });
  proc.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'uncaught exception');
    void stop(1);
  });
}
