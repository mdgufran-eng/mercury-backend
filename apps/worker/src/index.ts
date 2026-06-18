import { Worker, Job } from 'bullmq';
import { connectMongo, QUEUES, BullMQBroker } from '@mercury/core';
import type { TranslateJobData, WebhookJobData, CostPoJobData } from '@mercury/core';

import { handleTranslation } from './handlers/translation.js';
import { handleWebhook } from './handlers/webhook.js';
import { handleCostPo } from './handlers/costPo.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

function makeConnectionOpts() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

async function start() {
  const db = await connectMongo();
  const connection = makeConnectionOpts();

  // Swap BullMQBroker for KafkaBroker or TemporalWorkflowRunner here when ready.
  const broker = new BullMQBroker(connection);

  const translateWorker = new Worker<TranslateJobData>(
    QUEUES.TRANSLATE,
    (job: Job<TranslateJobData>) => handleTranslation(job, db, broker),
    { connection },
  );

  const webhookWorker = new Worker<WebhookJobData>(
    QUEUES.WEBHOOK,
    (job: Job<WebhookJobData>) => handleWebhook(job, db),
    { connection },
  );

  const costPoWorker = new Worker<CostPoJobData>(
    QUEUES.COST_PO,
    (job: Job<CostPoJobData>) => handleCostPo(job, db),
    { connection },
  );

  function attachListeners(worker: Worker, name: string): void {
    worker.on('completed', (job) => console.log(`[${name}] Job ${job.id} completed`));
    worker.on('failed', (job, err) =>
      console.error(`[${name}] Job ${job?.id} failed:`, err.message),
    );
    worker.on('error', (err) => console.error(`[${name}] Worker error:`, err));
  }

  attachListeners(translateWorker, QUEUES.TRANSLATE);
  attachListeners(webhookWorker, QUEUES.WEBHOOK);
  attachListeners(costPoWorker, QUEUES.COST_PO);

  console.log('Mercury workers started');

  async function shutdown() {
    await Promise.all([translateWorker.close(), webhookWorker.close(), costPoWorker.close()]);
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

start().catch((err) => {
  console.error('Worker startup failed:', err);
  process.exit(1);
});
