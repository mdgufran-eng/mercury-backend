"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCostPo = handleCostPo;
async function handleCostPo(job, _db) {
    // Cost/PO creation is handled synchronously by POST /costs in the API (B5).
    // This queue entry exists for future async PO generation (e.g. PDF rendering, B5+).
    job.log(`[cost-po] projectId=${job.data.projectId} billableWords=${job.data.billableWords} — handled by API`);
}
