// Domain types
export * from './types/domain.js';
export * from './types/jobPayloads.js';

// DB helpers
export { connectMongo, closeMongo, getDb } from './db/connection.js';
export * as Collections from './db/collections.js';
export { createIndexes } from './db/indexes.js';
export { runSeed } from './seed/seed.js';

// Queue names (used internally by BullMQBroker)
export { QUEUES } from './queues/names.js';
export type { QueueName } from './queues/names.js';

// ID generator
export { nextId, nextIdRange } from './utils/id.js';

// Webhook builders
export {
  buildProjectCreatedWebhook,
  buildAnalysisFinishedWebhook,
  buildJobFinishedWebhook,
  buildProjectCompletionWebhook,
  buildSourceFileUpdatedWebhook,
  buildActivityChangedWebhook,
} from './webhooks/CallbackBuilder.js';
export type { WebhookRequest } from './webhooks/CallbackBuilder.js';

// ── Ports (interfaces) ────────────────────────────────────────────────────────
export type { MessageBroker } from './ports/MessageBroker.js';
export type { WorkflowRunner } from './ports/WorkflowRunner.js';

// ── Adapters (swap to change infrastructure) ──────────────────────────────────
export { BullMQBroker } from './adapters/BullMQBroker.js';
export { BullMQWorkflowRunner } from './adapters/BullMQWorkflowRunner.js';
// export { KafkaBroker } from './adapters/KafkaBroker.js';
// export { TemporalWorkflowRunner } from './adapters/TemporalWorkflowRunner.js';

// ── ML service client (own model — ML service owns translation) ───────────────
export * as MLService from './ml/MLServiceClient.js';

// ── Segmenter (sentence split + tag extraction, runs locally) ─────────────────
export * as Segmenter from './tm/Segmenter.js';

// ── QA checks (used for segment approval) ─────────────────────────────────────
export * as QA from './tm/qa.js';

// ── Translation pipeline activities (BullMQ today, Temporal-ready tomorrow) ───
export {
  fetchProjectAndJob,
  segmentJob,
  translateMisses,
  persistSegments,
  finaliseJob,
  persistHumanSegments,
  fireJobCallbacks,
} from './workflows/translation.js';

// ── Translation chain (own model → Gemini fallback) ──────────────────────────
export { translateWithFallback } from './translation/chain.js';
export type { TranslationSegment, TranslationResult } from './translation/chain.js';
