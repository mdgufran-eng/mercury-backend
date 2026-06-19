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
} from '@mercury/core';
import type { TranslateJobData, MessageBroker } from '@mercury/core';

export type { TranslateJobData };

export async function handleTranslation(
  job: Job<TranslateJobData>,
  db: Db,
  broker: MessageBroker,
): Promise<void> {
  const { projectId, jobId } = job.data;

  const { project, job: jobDoc } = await fetchProjectAndJob(db, projectId, jobId);

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

  // Fix 5: reuse cached translations for unchanged segments (set by reanalyze/re-upload).
  // segmentCache maps sourceHash → previous target so unchanged sentences skip ML entirely.
  const rawCache = (jobDoc as unknown as Record<string, unknown>)['segmentCache'] as Record<string, string> | undefined;
  const cachedHits = new Map<string, string>(); // segId → cached target
  const needsML: typeof segments = [];

  if (rawCache && Object.keys(rawCache).length > 0) {
    for (const seg of segments) {
      const hash = createHash('sha256').update(seg.source.trim().replace(/\s+/g, ' ')).digest('hex');
      const cached = rawCache[hash];
      if (cached) {
        cachedHits.set(seg.id, cached);
      } else {
        needsML.push(seg);
      }
    }
    // Clear cache after use — it's a one-shot operational field
    await Collections.jobs(db).updateOne({ jobId }, { $unset: { segmentCache: '' } });
    job.log(`Segment cache: ${cachedHits.size} reused, ${needsML.length} to translate`);
  } else {
    needsML.push(...segments);
  }

  const mtMap = await translateMisses(needsML, sourceLanguage, targetLanguage);

  const { billableWords, targetMap } = await persistSegments(
    db, jobId, projectId, segments,
    cachedHits, // treated as ICE hits — free, no ML cost
    mtMap,
  );

  await finaliseJob(db, jobId, projectId, sourceContent, segments, targetMap, billableWords);
  await fireJobCallbacks(db, broker, project, jobId);

  job.log(
    `Done: ${segments.length} segments, ${cachedHits.size} cached (ICE), ${needsML.length} translated (MT), ${billableWords} billable words`,
  );
}
