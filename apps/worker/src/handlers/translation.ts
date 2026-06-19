import { createHash } from 'crypto';
import { Job } from 'bullmq';
import { Db } from 'mongodb';
import {
  Collections,
  fetchProjectAndJob,
  segmentJob,
  translateMisses,
  persistSegments,
  finaliseJob,
  fireJobCallbacks,
  persistHumanSegments,
  MongoTM,
} from '@mercury/core';
import type { TranslateJobData, MessageBroker } from '@mercury/core';

export type { TranslateJobData };

export async function handleTranslation(
  job: Job<TranslateJobData>,
  db: Db,
  broker: MessageBroker,
): Promise<void> {
  const { projectId, jobId } = job.data;

  try {
    await processTranslation(job, db, broker);
  } catch (err) {
    const maxAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await Collections.jobs(db).updateOne(
        { jobId },
        { $set: { status: 'FAILED', updatedAt: new Date() } },
      );
      await Collections.projects(db).updateOne(
        { projectId },
        { $set: { status: 'FAILED', updatedAt: new Date() } },
      );
    }
    throw err;
  }
}

async function processTranslation(
  job: Job<TranslateJobData>,
  db: Db,
  broker: MessageBroker,
): Promise<void> {
  const { projectId, jobId } = job.data;

  const { project, job: jobDoc } = await fetchProjectAndJob(db, projectId, jobId);
  rejectMercuryTargetFileAsSource(jobDoc.sourceContent);

  // Idempotency: skip if this job was already processed (worker retry after crash).
  if (jobDoc.status === 'FINISHED') {
    job.log(`Job ${jobId} already FINISHED — skipping duplicate`);
    return;
  }
  const existingSegments = await Collections.segments(db).countDocuments({ jobId });
  if (existingSegments > 0) {
    job.log(`Job ${jobId} already has ${existingSegments} segments — skipping duplicate`);
    return;
  }

  await Collections.jobs(db).updateOne(
    { jobId },
    { $set: { status: 'IN_PROGRESS', updatedAt: new Date() } },
  );
  await Collections.projects(db).updateOne(
    { projectId, status: { $ne: 'FAILED' } },
    { $set: { status: 'IN_PROGRESS', updatedAt: new Date() } },
  );

  const { segments, sourceContent } = await segmentJob(jobDoc);

  // HUMAN: segment only — translators edit in the UI, complete via admin endpoint
  if (project.method === 'HUMAN') {
    await persistHumanSegments(db, jobId, projectId, segments);
    job.log(`HUMAN: ${segments.length} PENDING segments created for job ${jobId}`);
    return;
  }

  if (segments.length === 0) {
    job.log('No translatable segments — marking job finished');
    await finaliseJob(db, jobId, projectId, sourceContent, [], new Map(), 0);
    await fireJobCallbacks(db, broker, project, jobId);
    return;
  }

  const { sourceLanguage, targetLanguage } = project;

  // Reuse cached translations for unchanged segments (set by reanalyze/re-upload).
  const rawCache = (jobDoc as unknown as Record<string, unknown>)['segmentCache'] as Record<string, string> | undefined;
  const cachedHits = new Map<string, string>();
  const needsML: typeof segments = [];

  if (rawCache && Object.keys(rawCache).length > 0) {
    for (const seg of segments) {
      // Match the segment.sourceHash stored in MongoDB (raw SHA-256 of normalized source).
      // This is intentionally different from MongoTM.sourceHash() — they're independent systems.
      const hash = createHash('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex');
      const cached = rawCache[hash];
      if (cached) cachedHits.set(seg.id, cached);
      else needsML.push(seg);
    }
    await Collections.jobs(db).updateOne({ jobId }, { $unset: { segmentCache: '' } });
    job.log(`Segment cache: ${cachedHits.size} reused, ${needsML.length} to translate`);
  } else {
    needsML.push(...segments);
  }

  // ── MongoDB TM lookup ($in query, one round-trip) ─────────────────────────
  // Only checks sentences ≤ 20 words — where hit rate is meaningful (10-43%).
  const afterCache = needsML;
  const tmHits = await MongoTM.batchLookup(
    db,
    afterCache.map((s) => ({ id: s.id, text: s.source })),
    sourceLanguage,
    targetLanguage,
  );

  for (const [segId, target] of tmHits) {
    cachedHits.set(segId, target);
  }
  const afterTM = afterCache.filter((s) => !tmHits.has(s.id));

  if (tmHits.size > 0) {
    job.log(`MongoDB TM: ${tmHits.size} hits, ${afterTM.length} to ML service`);
  }

  const mtMap = await translateMisses(afterTM, sourceLanguage, targetLanguage);

  const { billableWords, targetMap } = await persistSegments(
    db, jobId, projectId, segments,
    cachedHits,
    mtMap,
  );

  await finaliseJob(db, jobId, projectId, sourceContent, segments, targetMap, billableWords);
  await fireJobCallbacks(db, broker, project, jobId);

  job.log(
    `Done: ${segments.length} segs — ${tmHits.size} TM hits (free) + ${cachedHits.size - tmHits.size} cache hits + ${afterTM.length} ML translated — ${billableWords} billable words`,
  );
}

function rejectMercuryTargetFileAsSource(sourceContent: unknown): void {
  if (sourceContent === null || typeof sourceContent !== 'object') return;

  const metadata = (sourceContent as Record<string, unknown>)['metadata'];
  if (metadata === null || typeof metadata !== 'object') return;

  const record = metadata as Record<string, unknown>;
  const hasMercuryDownloadMetadata =
    typeof record['jobId'] === 'number' &&
    typeof record['projectId'] === 'number' &&
    typeof record['fileName'] === 'string' &&
    typeof record['sourceLanguage'] === 'string' &&
    typeof record['targetLanguage'] === 'string';

  if (hasMercuryDownloadMetadata) {
    throw new Error('Refusing to translate a Mercury target download as a source file. Upload the original source JSON instead.');
  }
}
