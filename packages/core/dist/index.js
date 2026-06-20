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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.translateWithFallback = exports.fireJobCallbacks = exports.persistHumanSegments = exports.finaliseJob = exports.persistSegments = exports.translateMisses = exports.segmentJob = exports.fetchProjectAndJob = exports.QA = exports.MongoTM = exports.Segmenter = exports.MLService = exports.BullMQWorkflowRunner = exports.BullMQBroker = exports.buildActivityChangedWebhook = exports.buildSourceFileUpdatedWebhook = exports.buildProjectCompletionWebhook = exports.buildJobFinishedWebhook = exports.buildAnalysisFinishedWebhook = exports.buildProjectCreatedWebhook = exports.nextIdRange = exports.nextId = exports.QUEUES = exports.runSeed = exports.createIndexes = exports.Collections = exports.getDb = exports.closeMongo = exports.connectMongo = void 0;
// Domain types
__exportStar(require("./types/domain.js"), exports);
__exportStar(require("./types/jobPayloads.js"), exports);
// DB helpers
var connection_js_1 = require("./db/connection.js");
Object.defineProperty(exports, "connectMongo", { enumerable: true, get: function () { return connection_js_1.connectMongo; } });
Object.defineProperty(exports, "closeMongo", { enumerable: true, get: function () { return connection_js_1.closeMongo; } });
Object.defineProperty(exports, "getDb", { enumerable: true, get: function () { return connection_js_1.getDb; } });
exports.Collections = __importStar(require("./db/collections.js"));
var indexes_js_1 = require("./db/indexes.js");
Object.defineProperty(exports, "createIndexes", { enumerable: true, get: function () { return indexes_js_1.createIndexes; } });
var seed_js_1 = require("./seed/seed.js");
Object.defineProperty(exports, "runSeed", { enumerable: true, get: function () { return seed_js_1.runSeed; } });
// Queue names (used internally by BullMQBroker)
var names_js_1 = require("./queues/names.js");
Object.defineProperty(exports, "QUEUES", { enumerable: true, get: function () { return names_js_1.QUEUES; } });
// ID generator
var id_js_1 = require("./utils/id.js");
Object.defineProperty(exports, "nextId", { enumerable: true, get: function () { return id_js_1.nextId; } });
Object.defineProperty(exports, "nextIdRange", { enumerable: true, get: function () { return id_js_1.nextIdRange; } });
// Webhook builders
var CallbackBuilder_js_1 = require("./webhooks/CallbackBuilder.js");
Object.defineProperty(exports, "buildProjectCreatedWebhook", { enumerable: true, get: function () { return CallbackBuilder_js_1.buildProjectCreatedWebhook; } });
Object.defineProperty(exports, "buildAnalysisFinishedWebhook", { enumerable: true, get: function () { return CallbackBuilder_js_1.buildAnalysisFinishedWebhook; } });
Object.defineProperty(exports, "buildJobFinishedWebhook", { enumerable: true, get: function () { return CallbackBuilder_js_1.buildJobFinishedWebhook; } });
Object.defineProperty(exports, "buildProjectCompletionWebhook", { enumerable: true, get: function () { return CallbackBuilder_js_1.buildProjectCompletionWebhook; } });
Object.defineProperty(exports, "buildSourceFileUpdatedWebhook", { enumerable: true, get: function () { return CallbackBuilder_js_1.buildSourceFileUpdatedWebhook; } });
Object.defineProperty(exports, "buildActivityChangedWebhook", { enumerable: true, get: function () { return CallbackBuilder_js_1.buildActivityChangedWebhook; } });
// ── Adapters (swap to change infrastructure) ──────────────────────────────────
var BullMQBroker_js_1 = require("./adapters/BullMQBroker.js");
Object.defineProperty(exports, "BullMQBroker", { enumerable: true, get: function () { return BullMQBroker_js_1.BullMQBroker; } });
var BullMQWorkflowRunner_js_1 = require("./adapters/BullMQWorkflowRunner.js");
Object.defineProperty(exports, "BullMQWorkflowRunner", { enumerable: true, get: function () { return BullMQWorkflowRunner_js_1.BullMQWorkflowRunner; } });
// export { KafkaBroker } from './adapters/KafkaBroker.js';
// export { TemporalWorkflowRunner } from './adapters/TemporalWorkflowRunner.js';
// ── ML service client (own model — ML service owns translation) ───────────────
exports.MLService = __importStar(require("./ml/MLServiceClient.js"));
// ── Segmenter (sentence split + tag extraction, runs locally) ─────────────────
exports.Segmenter = __importStar(require("./tm/Segmenter.js"));
// ── MongoDB TM (exact match, short sentences only, TM_WORD_LIMIT ≤ 20) ───────
exports.MongoTM = __importStar(require("./tm/MongoTM.js"));
// ── QA checks (used for segment approval) ─────────────────────────────────────
exports.QA = __importStar(require("./tm/qa.js"));
// ── Translation pipeline activities (BullMQ today, Temporal-ready tomorrow) ───
var translation_js_1 = require("./workflows/translation.js");
Object.defineProperty(exports, "fetchProjectAndJob", { enumerable: true, get: function () { return translation_js_1.fetchProjectAndJob; } });
Object.defineProperty(exports, "segmentJob", { enumerable: true, get: function () { return translation_js_1.segmentJob; } });
Object.defineProperty(exports, "translateMisses", { enumerable: true, get: function () { return translation_js_1.translateMisses; } });
Object.defineProperty(exports, "persistSegments", { enumerable: true, get: function () { return translation_js_1.persistSegments; } });
Object.defineProperty(exports, "finaliseJob", { enumerable: true, get: function () { return translation_js_1.finaliseJob; } });
Object.defineProperty(exports, "persistHumanSegments", { enumerable: true, get: function () { return translation_js_1.persistHumanSegments; } });
Object.defineProperty(exports, "fireJobCallbacks", { enumerable: true, get: function () { return translation_js_1.fireJobCallbacks; } });
// ── Translation chain (own model → Gemini fallback) ──────────────────────────
var chain_js_1 = require("./translation/chain.js");
Object.defineProperty(exports, "translateWithFallback", { enumerable: true, get: function () { return chain_js_1.translateWithFallback; } });
