"use strict";
/**
 * Translation pipeline expressed as discrete, pure-async activity functions.
 *
 * TODAY  — called sequentially by the BullMQ translation worker.
 * FUTURE — each function becomes a Temporal Activity decorated with proxyActivities():
 *
 *   import { proxyActivities } from '@temporalio/workflow';
 *   import type * as acts from './translation';
 *   const { fetchProjectAndJob, segmentJob, translateMisses,
 *           persistSegments, finaliseJob, fireJobCallbacks } =
 *     proxyActivities<typeof acts>({ startToCloseTimeout: '10 minutes' });
 *
 * Each activity gets independent retry, timeout, and visibility in the Temporal UI.
 * The workflow can compensate (roll back) on partial failures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProjectAndJob = fetchProjectAndJob;
exports.segmentJob = segmentJob;
exports.translateMisses = translateMisses;
exports.persistSegments = persistSegments;
exports.finaliseJob = finaliseJob;
exports.fireJobCallbacks = fireJobCallbacks;
exports.persistHumanSegments = persistHumanSegments;
const crypto_1 = require("crypto");
const index_js_1 = require("../index.js");
const index_js_2 = require("../index.js");
const chain_js_1 = require("../translation/chain.js");
const CallbackBuilder_js_1 = require("../webhooks/CallbackBuilder.js");
// ── Activity: fetch project + job from DB ─────────────────────────────────────
async function fetchProjectAndJob(db, projectId, jobId) {
    const [project, job] = await Promise.all([
        index_js_1.Collections.projects(db).findOne({ projectId }),
        index_js_1.Collections.jobs(db).findOne({ jobId }),
    ]);
    if (!project || !job)
        throw new Error(`Project ${projectId} or Job ${jobId} not found`);
    return { project, job };
}
async function segmentJob(job) {
    const fullContent = (job.sourceContent ?? {});
    // Detect rosetta File envelope: {content: {...}, metadata: {...}}
    // Only segment the content part, not the metadata.
    const isRosettaFile = fullContent['content'] !== null &&
        typeof fullContent['content'] === 'object' &&
        fullContent['metadata'] !== undefined;
    const toSegment = isRosettaFile
        ? fullContent['content']
        : fullContent;
    return { segments: index_js_2.Segmenter.extract(toSegment), sourceContent: fullContent };
}
// ── Activity: translate segments via own model ───────────────────────────────
async function translateMisses(misses, sourceLanguage, targetLanguage) {
    if (misses.length === 0)
        return new Map();
    const results = await (0, chain_js_1.translateWithFallback)(misses.map((s) => ({ id: s.id, text: s.source })), sourceLanguage, targetLanguage);
    return new Map(results.map((r) => [r.id, r.text]));
}
async function persistSegments(db, jobId, projectId, segments, tmHits, mtTranslations) {
    const allTranslations = new Map([...tmHits, ...mtTranslations]);
    const now = new Date();
    let billableWords = 0;
    const docs = [];
    for (const seg of segments) {
        const isICE = tmHits.has(seg.id);
        const translatedTagged = allTranslations.get(seg.id) ?? seg.source;
        const targetExpanded = index_js_2.Segmenter.expandTags(translatedTagged, seg.tags);
        if (!isICE)
            billableWords += seg.wordCount;
        docs.push({
            segmentId: await (0, index_js_1.nextId)(db, 'segment'),
            jobId,
            projectId,
            index: seg.sentenceIndex,
            fieldKey: seg.fieldKey,
            source: seg.source,
            target: targetExpanded,
            sourceHash: (0, crypto_1.createHash)('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex'),
            matchType: isICE ? 'ICE' : 'MT',
            state: 'TRANSLATED',
            approved: false,
            locked: isICE,
            tags: seg.tags,
            createdAt: now,
            updatedAt: now,
        });
    }
    if (docs.length > 0)
        await index_js_1.Collections.segments(db).insertMany(docs);
    return { billableWords, targetMap: allTranslations };
}
// ── Activity: write target content + mark job FINISHED ────────────────────────
async function finaliseJob(db, jobId, projectId, sourceContent, segments, targetMap, billableWords) {
    // Detect rosetta File envelope: preserve metadata, reassemble only content part.
    const isRosettaFile = sourceContent['content'] !== null &&
        typeof sourceContent['content'] === 'object' &&
        sourceContent['metadata'] !== undefined;
    let targetContent;
    if (isRosettaFile && segments.length > 0) {
        const translatedContent = index_js_2.Segmenter.reassemble(sourceContent['content'], segments, targetMap);
        targetContent = { content: translatedContent, metadata: sourceContent['metadata'] };
    }
    else if (segments.length > 0) {
        targetContent = index_js_2.Segmenter.reassemble(sourceContent, segments, targetMap);
    }
    else {
        targetContent = sourceContent;
    }
    await index_js_1.Collections.jobs(db).updateOne({ jobId }, { $set: { targetContent, status: 'FINISHED', billableWords, updatedAt: new Date() } });
    const unfinished = await index_js_1.Collections.jobs(db).countDocuments({
        projectId,
        status: { $ne: 'FINISHED' },
    });
    if (unfinished === 0) {
        await index_js_1.Collections.projects(db).updateOne({ projectId }, { $set: { status: 'FINISHED', updatedAt: new Date() } });
    }
}
// ── Activity: fire outbound callbacks ─────────────────────────────────────────
async function fireJobCallbacks(db, broker, project, jobId) {
    const { projectId, customerId, callbackUrls } = project;
    const now = new Date();
    if (callbackUrls?.jobFinished) {
        await persistAndEnqueue(db, broker, {
            projectId,
            jobId,
            customerId,
            event: 'job-finished',
            build: () => (0, CallbackBuilder_js_1.buildJobFinishedWebhook)(callbackUrls.jobFinished, projectId, jobId, customerId),
            now,
        });
    }
    const unfinished = await index_js_1.Collections.jobs(db).countDocuments({
        projectId,
        status: { $ne: 'FINISHED' },
    });
    if (unfinished === 0 && callbackUrls?.projectCompletion) {
        await persistAndEnqueue(db, broker, {
            projectId,
            customerId,
            event: 'project-completion',
            build: () => (0, CallbackBuilder_js_1.buildProjectCompletionWebhook)(callbackUrls.projectCompletion, projectId, customerId),
            now,
        });
    }
}
// ── Activity: persist PENDING segments for HUMAN projects (no translation) ────
async function persistHumanSegments(db, jobId, projectId, segments) {
    if (segments.length === 0)
        return;
    const now = new Date();
    const docs = [];
    for (const seg of segments) {
        docs.push({
            segmentId: await (0, index_js_1.nextId)(db, 'segment'),
            jobId,
            projectId,
            index: seg.sentenceIndex,
            fieldKey: seg.fieldKey,
            source: seg.source,
            target: undefined,
            sourceHash: (0, crypto_1.createHash)('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex'),
            matchType: undefined,
            state: 'PENDING',
            approved: false,
            locked: false,
            tags: seg.tags,
            createdAt: now,
            updatedAt: now,
        });
    }
    await index_js_1.Collections.segments(db).insertMany(docs);
}
async function persistAndEnqueue(db, broker, opts) {
    const req = opts.build();
    const callbackId = await (0, index_js_1.nextId)(db, 'callback');
    await index_js_1.Collections.callbackLogs(db).insertOne({
        callbackId,
        projectId: opts.projectId,
        jobId: opts.jobId,
        event: opts.event,
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body,
        payload: {},
        attempts: 0,
        success: false,
        createdAt: opts.now,
    });
    await broker.enqueueWebhook({
        callbackId,
        projectId: opts.projectId,
        jobId: opts.jobId,
        customerId: opts.customerId,
        event: opts.event,
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body,
    });
}
