import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryEventStore } from './store/memory-store.js';

const config = loadConfig();

// TODO(BE-1): PostgresEventStore when config.databaseUrl is set.
const app = buildApp({ store: new MemoryEventStore() });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({ port: config.port, host: '0.0.0.0' });
