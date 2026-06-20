"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const core_1 = require("@mercury/core");
const translation_js_1 = require("./handlers/translation.js");
const webhook_js_1 = require("./handlers/webhook.js");
const costPo_js_1 = require("./handlers/costPo.js");
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
function makeConnectionOpts() {
    const url = new URL(REDIS_URL);
    return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        maxRetriesPerRequest: null,
    };
}
async function start() {
    const db = await (0, core_1.connectMongo)();
    const connection = makeConnectionOpts();
    // Swap BullMQBroker for KafkaBroker or TemporalWorkflowRunner here when ready.
    const broker = new core_1.BullMQBroker(connection);
    const translateWorker = new bullmq_1.Worker(core_1.QUEUES.TRANSLATE, (job) => (0, translation_js_1.handleTranslation)(job, db, broker), { connection });
    const webhookWorker = new bullmq_1.Worker(core_1.QUEUES.WEBHOOK, (job) => (0, webhook_js_1.handleWebhook)(job, db), { connection });
    const costPoWorker = new bullmq_1.Worker(core_1.QUEUES.COST_PO, (job) => (0, costPo_js_1.handleCostPo)(job, db), { connection });
    function attachListeners(worker, name) {
        worker.on('completed', (job) => console.log(`[${name}] Job ${job.id} completed`));
        worker.on('failed', (job, err) => console.error(`[${name}] Job ${job?.id} failed:`, err.stack ?? err.message));
        worker.on('error', (err) => console.error(`[${name}] Worker error:`, err));
    }
    attachListeners(translateWorker, core_1.QUEUES.TRANSLATE);
    attachListeners(webhookWorker, core_1.QUEUES.WEBHOOK);
    attachListeners(costPoWorker, core_1.QUEUES.COST_PO);
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
