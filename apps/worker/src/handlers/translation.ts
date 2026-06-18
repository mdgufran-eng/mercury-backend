import { Job } from 'bullmq';

export interface TranslateJobData {
  projectId: number;
  jobId: number;
  sourceFileKey: string;
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Handles translation jobs from the `translate` queue.
 * TODO:
 *  1. Fetch source file from MinIO using sourceFileKey
 *  2. Parse XLIFF/segments from source file
 *  3. Look up TM for existing matches (ICE match)
 *  4. Send unmatched segments to ML service (/translate)
 *  5. Merge TM hits + MT results
 *  6. Write translated XLIFF to MinIO (targetFileKey)
 *  7. Update Job status → FINISHED in MongoDB
 *  8. Enqueue webhook job for job-finished event
 */
export async function handleTranslation(job: Job<TranslateJobData>): Promise<{ success: boolean }> {
  console.log(`[translate] Processing job ${job.id}`, job.data);
  // TODO: implement translation pipeline
  return { success: true };
}
