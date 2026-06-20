"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = handleWebhook;
const axios_1 = __importDefault(require("axios"));
const core_1 = require("@mercury/core");
async function handleWebhook(job, db) {
    const { callbackId, projectId, event, url, method, headers, body } = job.data;
    const now = new Date();
    try {
        const response = await (0, axios_1.default)({
            method,
            url,
            headers: headers ?? {},
            data: body,
            timeout: 10_000,
            validateStatus: () => true, // handle all statuses manually
        });
        const success = response.status >= 200 && response.status < 300;
        await core_1.Collections.callbackLogs(db).updateOne({ callbackId }, {
            $set: {
                responseStatus: response.status,
                success,
                lastAttemptAt: now,
            },
            $inc: { attempts: 1 },
        });
        if (!success) {
            throw new Error(`Callback ${event} to ${url} failed with status ${response.status} (projectId=${projectId})`);
        }
        job.log(`Delivered ${event} → ${url} [${response.status}]`);
    }
    catch (err) {
        await core_1.Collections.callbackLogs(db).updateOne({ callbackId }, { $set: { lastAttemptAt: now }, $inc: { attempts: 1 } });
        throw err;
    }
}
