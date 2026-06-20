"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueTranslate = enqueueTranslate;
exports.enqueueWebhook = enqueueWebhook;
exports.enqueueCostPo = enqueueCostPo;
const bullmq_1 = require("bullmq");
const names_js_1 = require("./names.js");
function makeQueue(name, connection) {
    return new bullmq_1.Queue(name, { connection });
}
async function enqueueTranslate(connection, data) {
    const q = makeQueue(names_js_1.QUEUES.TRANSLATE, connection);
    await q.add('translate', data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    await q.close();
}
async function enqueueWebhook(connection, data) {
    const q = makeQueue(names_js_1.QUEUES.WEBHOOK, connection);
    await q.add('webhook', data, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } });
    await q.close();
}
async function enqueueCostPo(connection, data) {
    const q = makeQueue(names_js_1.QUEUES.COST_PO, connection);
    await q.add('cost-po', data);
    await q.close();
}
