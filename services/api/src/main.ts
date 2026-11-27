import { collectDefaultMetrics } from 'prom-client';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { buildMetricsApp, createMetrics } from './metrics.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const metrics = createMetrics(pool);
collectDefaultMetrics({ register: metrics.registry });
const app = buildApp({ pool, authMode: config.authMode, metrics });
const metricsApp = buildMetricsApp(metrics.registry);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void Promise.all([app.close(), metricsApp.close()]).then(() => pool.end());
  });
}

await metricsApp.listen({ port: config.metricsPort, host: config.metricsHost });
await app.listen({ port: config.port, host: '0.0.0.0' });
