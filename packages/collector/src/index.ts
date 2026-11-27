// Public surface for other workspace packages (the e2e suite and testkit).
export type {
  CollectContext,
  CollectResult,
  Cursor,
  DetectResult,
  HarnessAdapter,
  Observation,
} from './adapters/types.js';
export { defaultAdapters } from './adapters/registry.js';
export type { EventBuffer, BufferStats } from './buffer/types.js';
export { MemoryBuffer } from './buffer/memory-buffer.js';
export type { CredentialProvider, DeviceCredential } from './auth/credential-provider.js';
export { StaticCredentialProvider } from './auth/credential-provider.js';
export { CollectorConfig, loadConfig } from './config.js';
export { createLogger, type Logger } from './logger.js';
export { collectOnce, flushOnce, runDaemon, type CollectStats, type DaemonDeps } from './daemon.js';
export { normalize, type NormalizeContext } from './normalize/normalizer.js';
export { applyPolicy, ContentLevel } from './policy/content-level.js';
export type { CatalogEntry, CatalogProvider } from './skills/catalog.js';
export type { InstalledSkill, SkillScanner } from './skills/inventory.js';
export type { Uploader, UploadOutcome } from './upload/uploader.js';
export { HttpUploader } from './upload/uploader.js';
