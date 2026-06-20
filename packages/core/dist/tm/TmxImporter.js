"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importTmx = importTmx;
const MLServiceClient_js_1 = require("../ml/MLServiceClient.js");
/**
 * Buffer the TMX stream and forward to the ML service for import.
 * The ML service owns TM storage and does its own streaming parse internally.
 *
 * For very large files (700 MB+) the ML service should ideally accept
 * chunked streaming — for v1 we buffer here and send as one request.
 */
async function importTmx(stream, sourceLang, targetLang) {
    const chunks = [];
    await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);
    return (0, MLServiceClient_js_1.tmImport)(buffer, sourceLang, targetLang);
}
