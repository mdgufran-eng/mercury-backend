import { Job } from 'bullmq';
import { Db } from 'mongodb';
import {
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
  const { segments, sourceContent } = await segmentJob(jobDoc);

  // HUMAN: segment only — translators edit in the UI, complete via admin endpoint
  if (project.method === 'HUMAN') {
    await persistHumanSegments(db, jobId, projectId, segments);
    job.log(`HUMAN: ${segments.length} PENDING segments created for job ${jobId}`);
    return;
  }

  // MACHINE: all segments go to own model (no TM pre-lookup)
  if (segments.length === 0) {
    job.log('No translatable segments — marking job finished');
    await finaliseJob(db, jobId, projectId, sourceContent, [], new Map(), 0);
    await fireJobCallbacks(db, broker, project, jobId);
    return;
  }

  const { sourceLanguage, targetLanguage } = project;

  const mtMap = await translateMisses(segments, sourceLanguage, targetLanguage);

  const { billableWords, targetMap } = await persistSegments(
    db, jobId, projectId, segments,
    new Map(), // no TM hits — all segments are MT
    mtMap,
  );

  await finaliseJob(db, jobId, projectId, sourceContent, segments, targetMap, billableWords);
  await fireJobCallbacks(db, broker, project, jobId);

  job.log(`Done: ${segments.length} segments translated, ${billableWords} billable words`);
}
