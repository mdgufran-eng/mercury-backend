"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTranslation = handleTranslation;
const crypto_1 = require("crypto");
const core_1 = require("@mercury/core");
async function handleTranslation(job, db, broker) {
    const { projectId, jobId } = job.data;
    try {
        await processTranslation(job, db, broker);
    }
    catch (err) {
        const maxAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
        const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
        if (isFinalAttempt) {
            await core_1.Collections.jobs(db).updateOne({ jobId }, { $set: { status: 'FAILED', updatedAt: new Date() } });
            await core_1.Collections.projects(db).updateOne({ projectId }, { $set: { status: 'FAILED', updatedAt: new Date() } });
        }
        throw err;
    }
}
async function processTranslation(job, db, broker) {
    const { projectId, jobId } = job.data;
    const { project, job: jobDoc } = await (0, core_1.fetchProjectAndJob)(db, projectId, jobId);
    rejectMercuryTargetFileAsSource(jobDoc.sourceContent);
    // Idempotency: skip if this job was already processed (worker retry after crash).
    if (jobDoc.status === 'FINISHED') {
        job.log(`Job ${jobId} already FINISHED — skipping duplicate`);
        return;
    }
    const existingSegments = await core_1.Collections.segments(db).countDocuments({ jobId });
    if (existingSegments > 0) {
        job.log(`Job ${jobId} already has ${existingSegments} segments — skipping duplicate`);
        return;
    }
    await core_1.Collections.jobs(db).updateOne({ jobId }, { $set: { status: 'IN_PROGRESS', updatedAt: new Date() } });
    await core_1.Collections.projects(db).updateOne({ projectId, status: { $ne: 'FAILED' } }, { $set: { status: 'IN_PROGRESS', updatedAt: new Date() } });
    const { segments, sourceContent } = await (0, core_1.segmentJob)(jobDoc);
    // HUMAN: segment only — translators edit in the UI, complete via admin endpoint
    if (project.method === 'HUMAN') {
        await (0, core_1.persistHumanSegments)(db, jobId, projectId, segments);
        job.log(`HUMAN: ${segments.length} PENDING segments created for job ${jobId}`);
        return;
    }
    if (segments.length === 0) {
        job.log('No translatable segments — marking job finished');
        await (0, core_1.finaliseJob)(db, jobId, projectId, sourceContent, [], new Map(), 0);
        await (0, core_1.fireJobCallbacks)(db, broker, project, jobId);
        return;
    }
    const { sourceLanguage, targetLanguage } = project;
    // Reuse cached translations for unchanged segments (set by reanalyze/re-upload).
    const rawCache = jobDoc['segmentCache'];
    const cachedHits = new Map();
    const needsML = [];
    if (rawCache && Object.keys(rawCache).length > 0) {
        for (const seg of segments) {
            // Match the segment.sourceHash stored in MongoDB (raw SHA-256 of normalized source).
            // This is intentionally different from MongoTM.sourceHash() — they're independent systems.
            const hash = (0, crypto_1.createHash)('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex');
            const cached = rawCache[hash];
            if (cached)
                cachedHits.set(seg.id, cached);
            else
                needsML.push(seg);
        }
        await core_1.Collections.jobs(db).updateOne({ jobId }, { $unset: { segmentCache: '' } });
        job.log(`Segment cache: ${cachedHits.size} reused, ${needsML.length} to translate`);
    }
    else {
        needsML.push(...segments);
    }
    // ── MongoDB TM lookup ($in query, one round-trip) ─────────────────────────
    // Only checks sentences ≤ 20 words — where hit rate is meaningful (10-43%).
    const afterCache = needsML;
    const tmHits = await core_1.MongoTM.batchLookup(db, afterCache.map((s) => ({ id: s.id, text: s.source })), sourceLanguage, targetLanguage);
    for (const [segId, target] of tmHits) {
        cachedHits.set(segId, target);
    }
    const afterTM = afterCache.filter((s) => !tmHits.has(s.id));
    if (tmHits.size > 0) {
        job.log(`MongoDB TM: ${tmHits.size} hits, ${afterTM.length} to ML service`);
    }
    const mtMap = await (0, core_1.translateMisses)(afterTM, sourceLanguage, targetLanguage);
    const { billableWords, targetMap } = await (0, core_1.persistSegments)(db, jobId, projectId, segments, cachedHits, mtMap);
    await (0, core_1.finaliseJob)(db, jobId, projectId, sourceContent, segments, targetMap, billableWords);
    await (0, core_1.fireJobCallbacks)(db, broker, project, jobId);
    job.log(`Done: ${segments.length} segs — ${tmHits.size} TM hits (free) + ${cachedHits.size - tmHits.size} cache hits + ${afterTM.length} ML translated — ${billableWords} billable words`);
}
function rejectMercuryTargetFileAsSource(sourceContent) {
    if (sourceContent === null || typeof sourceContent !== 'object')
        return;
    const metadata = sourceContent['metadata'];
    if (metadata === null || typeof metadata !== 'object')
        return;
    const record = metadata;
    const hasMercuryDownloadMetadata = typeof record['jobId'] === 'number' &&
        typeof record['projectId'] === 'number' &&
        typeof record['fileName'] === 'string' &&
        typeof record['sourceLanguage'] === 'string' &&
        typeof record['targetLanguage'] === 'string';
    if (hasMercuryDownloadMetadata) {
        throw new Error('Refusing to translate a Mercury target download as a source file. Upload the original source JSON instead.');
    }
}
