"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIndexes = createIndexes;
const Collections = __importStar(require("./collections.js"));
async function createIndexes(db) {
    await Promise.all([
        Collections.projects(db).createIndex({ projectId: 1 }, { unique: true }),
        Collections.projects(db).createIndex({ name: 1 }, { unique: true }),
        Collections.projects(db).createIndex({ customerId: 1 }),
        Collections.jobs(db).createIndex({ jobId: 1 }, { unique: true }),
        Collections.jobs(db).createIndex({ projectId: 1 }),
        Collections.jobs(db).createIndex({ status: 1 }),
        Collections.segments(db).createIndex({ segmentId: 1 }, { unique: true }),
        Collections.segments(db).createIndex({ jobId: 1 }),
        Collections.segments(db).createIndex({ projectId: 1 }),
        Collections.callbackLogs(db).createIndex({ projectId: 1 }),
        Collections.callbackLogs(db).createIndex({ success: 1 }),
        Collections.callbackLogs(db).createIndex({ callbackId: 1 }, { unique: true }),
        Collections.costs(db).createIndex({ projectId: 1 }),
        Collections.costs(db).createIndex({ costId: 1 }, { unique: true }),
        Collections.purchaseOrders(db).createIndex({ costId: 1 }),
        Collections.purchaseOrders(db).createIndex({ processId: 1 }, { unique: true }),
    ]);
}
