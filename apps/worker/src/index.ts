import { Worker, Job } from 'bullmq';
import { QUEUES } from '@mercury/core';

import { handleTranslation, TranslateJobData } from './handlers/translation.js';
import { handleWebhook, WebhookJobData } from './handlers/webhook.js';
import { handleCostPo, CostPoJobData } from './handlers/costPo.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// BullMQ bundles its own ioredis — pass connection options via URL string
// to avoid type mismatches with the top-level ioredis package.
function makeConnectionOpts() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

const translateWorker = new Worker<TranslateJobData>(
  QUEUES.TRANSLATE,
  (job: Job<TranslateJobData>) => handleTranslation(job),
  { connection: makeConnectionOpts() },
);

const webhookWorker = new Worker<WebhookJobData>(
  QUEUES.WEBHOOK,
  (job: Job<WebhookJobData>) => handleWebhook(job),
  {
    connection: makeConnectionOpts(),
    settings: { backoffStrategy: (attemptsMade: number) => Math.pow(2, attemptsMade) * 5000 },
  },
);

const costPoWorker = new Worker<CostPoJobData>(
  QUEUES.COST_PO,
  (job: Job<CostPoJobData>) => handleCostPo(job),
  { connection: makeConnectionOpts() },
);

function attachListeners(worker: Worker, name: string): void {
  worker.on('completed', (job) => {
    console.log(`[${name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${name}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[${name}] Worker error:`, err);
  });
}

attachListeners(translateWorker, QUEUES.TRANSLATE);
attachListeners(webhookWorker, QUEUES.WEBHOOK);
attachListeners(costPoWorker, QUEUES.COST_PO);

console.log('Mercury workers started');
console.log(`  - ${QUEUES.TRANSLATE} worker listening`);
console.log(`  - ${QUEUES.WEBHOOK} worker listening`);
console.log(`  - ${QUEUES.COST_PO} worker listening`);

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down workers...');
  await Promise.all([
    translateWorker.close(),
    webhookWorker.close(),
    costPoWorker.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });
