import { Job } from 'bullmq';

export interface WebhookJobData {
  callbackId: number;
  projectId: number;
  jobId?: number;
  event: string;
  url: string;
  payload: Record<string, unknown>;
}

/**
 * Handles webhook dispatch jobs from the `webhook` queue.
 * TODO:
 *  1. POST payload to url with a 10s timeout
 *  2. On success: update CallbackLog.success = true, responseStatus
 *  3. On failure: increment attempts, set lastAttemptAt
 *     - Retry up to 5 times with exponential backoff (handled by BullMQ opts)
 *     - After max retries: mark success = false, log failure
 */
export async function handleWebhook(job: Job<WebhookJobData>): Promise<{ success: boolean }> {
  console.log(`[webhook] Dispatching job ${job.id}`, {
    event: job.data.event,
    url: job.data.url,
    projectId: job.data.projectId,
  });
  // TODO: implement HTTP dispatch with retry logic
  return { success: true };
}
