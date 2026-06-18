import { Job } from 'bullmq';

export interface CostPoJobData {
  projectId: number;
  billableWords: number;
  ratePerWord?: number;
  currency?: string;
}

/**
 * Handles cost + purchase order generation from the `cost-po` queue.
 * TODO:
 *  1. Fetch project and all jobs from MongoDB
 *  2. Aggregate billableWords across jobs
 *  3. Apply rate card (ratePerWord from template or default)
 *  4. Generate cost record and persist to MongoDB
 *  5. Generate PO PDF/CSV and upload to MinIO
 *  6. Enqueue webhook for project-completion event if all jobs finished
 */
export async function handleCostPo(job: Job<CostPoJobData>): Promise<{ success: boolean }> {
  console.log(`[cost-po] Processing job ${job.id}`, job.data);
  // TODO: implement cost calculation and PO generation
  return { success: true };
}
