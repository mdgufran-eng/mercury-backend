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

import { createHash } from 'crypto';
import { Db } from 'mongodb';
import { Collections, nextId, nextIdRange } from '../index.js';
import { Segmenter } from '../index.js';
import { translateWithFallback } from '../translation/chain.js';
import {
  buildJobFinishedWebhook,
  buildProjectCompletionWebhook,
} from '../webhooks/CallbackBuilder.js';
import type { Project, Job, Segment, CallbackLog } from '../types/domain.js';
import type { MessageBroker } from '../ports/MessageBroker.js';

// ── Activity: fetch project + job from DB ─────────────────────────────────────

export async function fetchProjectAndJob(
  db: Db,
  projectId: number,
  jobId: number,
): Promise<{ project: Project; job: Job }> {
  const [project, job] = await Promise.all([
    Collections.projects(db).findOne({ projectId }),
    Collections.jobs(db).findOne({ jobId }),
  ]);
  if (!project || !job) throw new Error(`Project ${projectId} or Job ${jobId} not found`);
  return { project, job };
}

// ── Activity: segment the source JSON ────────────────────────────────────────

export interface ExtractedResult {
  segments: ReturnType<typeof Segmenter.extract>;
  sourceContent: Record<string, unknown>;
}

export async function segmentJob(job: Job): Promise<ExtractedResult> {
  const fullContent = (job.sourceContent ?? {}) as Record<string, unknown>;
  // Detect rosetta File envelope: {content: {...}, metadata: {...}}
  // Only segment the content part, not the metadata.
  const isRosettaFile =
    fullContent['content'] !== null &&
    typeof fullContent['content'] === 'object' &&
    fullContent['metadata'] !== undefined;
  const toSegment = isRosettaFile
    ? (fullContent['content'] as Record<string, unknown>)
    : fullContent;
  return { segments: Segmenter.extract(toSegment), sourceContent: fullContent };
}

// ── Activity: translate segments via own model ───────────────────────────────

export async function translateMisses(
  misses: ReturnType<typeof Segmenter.extract>,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<Map<string, string>> {
  if (misses.length === 0) return new Map();
  const results = await translateWithFallback(
    misses.map((s) => ({ id: s.id, text: s.source })),
    sourceLanguage,
    targetLanguage,
  );
  return new Map(results.map((r) => [r.id, r.text]));
}

// ── Activity: persist segments to DB + count billable words ──────────────────

export interface PersistResult {
  billableWords: number;
  targetMap: Map<string, string>; // segmentId → translated tagged text
}

export async function persistSegments(
  db: Db,
  jobId: number,
  projectId: number,
  segments: ReturnType<typeof Segmenter.extract>,
  tmHits: Map<string, string>,
  mtTranslations: Map<string, string>,
): Promise<PersistResult> {
  const allTranslations = new Map([...tmHits, ...mtTranslations]);
  const now = new Date();
  let billableWords = 0;
  const docs: Segment[] = [];

  // Allocate all segment IDs in one round-trip instead of N sequential calls.
  const segmentIds = await nextIdRange(db, 'segment', segments.length);

  segments.forEach((seg, i) => {
    const isICE = tmHits.has(seg.id);
    const translatedTagged = allTranslations.get(seg.id) ?? seg.source;
    const targetExpanded = Segmenter.expandTags(translatedTagged, seg.tags);
    if (!isICE) billableWords += seg.wordCount;

    docs.push({
      segmentId: segmentIds[i]!,
      jobId,
      projectId,
      index: seg.sentenceIndex,
      fieldKey: seg.fieldKey,
      source: seg.source,
      target: targetExpanded,
      sourceHash: createHash('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex'),
      matchType: isICE ? 'ICE' : 'MT',
      state: 'TRANSLATED',
      approved: false,
      locked: isICE,
      tags: seg.tags,
      createdAt: now,
      updatedAt: now,
    });
  });

  if (docs.length > 0) await Collections.segments(db).insertMany(docs);
  return { billableWords, targetMap: allTranslations };
}

// ── Activity: write target content + mark job FINISHED ────────────────────────

export async function finaliseJob(
  db: Db,
  jobId: number,
  projectId: number,
  sourceContent: Record<string, unknown>,
  segments: ReturnType<typeof Segmenter.extract>,
  targetMap: Map<string, string>,
  billableWords: number,
): Promise<void> {
  // Detect rosetta File envelope: preserve metadata, reassemble only content part.
  const isRosettaFile =
    sourceContent['content'] !== null &&
    typeof sourceContent['content'] === 'object' &&
    sourceContent['metadata'] !== undefined;

  let targetContent: Record<string, unknown>;
  if (isRosettaFile && segments.length > 0) {
    const translatedContent = Segmenter.reassemble(
      sourceContent['content'] as Record<string, unknown>,
      segments,
      targetMap,
    );
    targetContent = { content: translatedContent, metadata: sourceContent['metadata'] };
  } else if (segments.length > 0) {
    targetContent = Segmenter.reassemble(sourceContent, segments, targetMap);
  } else {
    targetContent = sourceContent;
  }

  await Collections.jobs(db).updateOne(
    { jobId },
    { $set: { targetContent, status: 'FINISHED', billableWords, updatedAt: new Date() } },
  );

  const unfinished = await Collections.jobs(db).countDocuments({
    projectId,
    status: { $ne: 'FINISHED' },
  });

  if (unfinished === 0) {
    await Collections.projects(db).updateOne(
      { projectId },
      { $set: { status: 'FINISHED', updatedAt: new Date() } },
    );
  }
}

// ── Activity: fire outbound callbacks ─────────────────────────────────────────

export async function fireJobCallbacks(
  db: Db,
  broker: MessageBroker,
  project: Project,
  jobId: number,
): Promise<void> {
  const { projectId, customerId, callbackUrls } = project;
  const now = new Date();

  if (callbackUrls?.jobFinished) {
    const job = await Collections.jobs(db).findOne({ jobId });
    const translatedContent = job?.targetContent;
    await persistAndEnqueue(db, broker, {
      projectId,
      jobId,
      customerId,
      event: 'job-finished',
      build: () => buildJobFinishedWebhook(callbackUrls.jobFinished!, projectId, jobId, customerId, translatedContent),
      payload: { xtmProjectId: projectId, xtmJobId: jobId, xtmCustomerId: customerId, translatedContent },
      now,
    });
  }

  const unfinished = await Collections.jobs(db).countDocuments({
    projectId,
    status: { $ne: 'FINISHED' },
  });

  if (unfinished === 0 && callbackUrls?.projectCompletion) {
    await persistAndEnqueue(db, broker, {
      projectId,
      customerId,
      event: 'project-completion',
      build: () =>
        buildProjectCompletionWebhook(callbackUrls.projectCompletion!, projectId, customerId),
      payload: { xtmProjectId: projectId, xtmCustomerId: customerId },
      now,
    });
  }
}

// ── Activity: persist PENDING segments for HUMAN projects (no translation) ────

export async function persistHumanSegments(
  db: Db,
  jobId: number,
  projectId: number,
  segments: ReturnType<typeof Segmenter.extract>,
): Promise<void> {
  if (segments.length === 0) return;
  const now = new Date();
  const docs: Segment[] = [];
  const segmentIds = await nextIdRange(db, 'segment', segments.length);
  segments.forEach((seg, i) => {
    docs.push({
      segmentId: segmentIds[i]!,
      jobId,
      projectId,
      index: seg.sentenceIndex,
      fieldKey: seg.fieldKey,
      source: seg.source,
      target: undefined,
      sourceHash: createHash('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex'),
      matchType: undefined,
      state: 'PENDING',
      approved: false,
      locked: false,
      tags: seg.tags,
      createdAt: now,
      updatedAt: now,
    });
  });
  await Collections.segments(db).insertMany(docs);
}

async function persistAndEnqueue(
  db: Db,
  broker: MessageBroker,
  opts: {
    projectId: number;
    jobId?: number;
    customerId: number;
    event: CallbackLog['event'];
    build: () => import('../webhooks/CallbackBuilder.js').WebhookRequest;
    payload?: Record<string, unknown>;
    now: Date;
  },
): Promise<void> {
  const req = opts.build();
  const callbackId = await nextId(db, 'callback');

  await Collections.callbackLogs(db).insertOne({
    callbackId,
    projectId: opts.projectId,
    jobId: opts.jobId,
    event: opts.event,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    payload: opts.payload ?? {},
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
