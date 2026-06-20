"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMQBroker = void 0;
const bullmq_1 = require("bullmq");
const names_js_1 = require("../queues/names.js");
class BullMQBroker {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async enqueueTranslate(data) {
        await this.add(names_js_1.QUEUES.TRANSLATE, 'translate', data, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
        });
    }
    async enqueueWebhook(data) {
        await this.add(names_js_1.QUEUES.WEBHOOK, 'webhook', data, {
            attempts: 5,
            backoff: { type: 'exponential', delay: 5_000 },
        });
    }
    async enqueueCostPo(data) {
        await this.add(names_js_1.QUEUES.COST_PO, 'cost-po', data);
    }
    async add(queueName, jobName, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data, opts = {}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = new bullmq_1.Queue(queueName, { connection: this.conn });
        await q.add(jobName, data, opts);
        await q.close();
    }
}
exports.BullMQBroker = BullMQBroker;
