import { collectDefaultMetrics } from 'prom-client';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { buildMetricsApp, createMetrics } from './metrics.js';
import { MemoryEventStore } from './store/memory-store.js';

const config = loadConfig();
const metrics = createMetrics();
collectDefaultMetrics({ register: metrics.registry });

// TODO(BE-1): PostgresEventStore when config.databaseUrl is set.
const app = buildApp({ store: new MemoryEventStore(), metrics });
const metricsApp = buildMetricsApp(metrics.registry);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void Promise.all([app.close(), metricsApp.close()]));
}

await metricsApp.listen({ port: config.metricsPort, host: config.metricsHost });
await app.listen({ port: config.port, host: '0.0.0.0' });
