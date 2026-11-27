import { collectDefaultMetrics } from 'prom-client';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { buildMetricsApp, createMetrics } from './metrics.js';
import { handleShutdown } from './shutdown.js';
import { MemoryEventStore } from './store/memory-store.js';

const config = loadConfig();
const metrics = createMetrics();
collectDefaultMetrics({ register: metrics.registry });

// TODO(BE-1): PostgresEventStore when config.databaseUrl is set.
const app = buildApp({ store: new MemoryEventStore(), metrics, timeouts: config.timeouts });
const metricsApp = buildMetricsApp(metrics.registry);

handleShutdown({ app, metricsApp, deadlineMs: config.shutdownTimeoutMs });

await metricsApp.listen({ port: config.metricsPort, host: config.metricsHost });
await app.listen({ port: config.port, host: '0.0.0.0' });
