import { collectDefaultMetrics } from 'prom-client';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { buildMetricsApp, createMetrics } from './metrics.js';
import { handleShutdown } from './shutdown.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl, config.db);
const metrics = createMetrics(pool);
collectDefaultMetrics({ register: metrics.registry });
const app = buildApp({ pool, authMode: config.authMode, metrics, limits: config.http });
const metricsApp = buildMetricsApp(metrics.registry);

handleShutdown({
  app,
  metricsApp,
  cleanup: () => pool.end(),
  deadlineMs: config.shutdownTimeoutMs,
});

await metricsApp.listen({ port: config.metricsPort, host: config.metricsHost });
await app.listen({ port: config.port, host: '0.0.0.0' });
