import { Job } from 'bullmq';
import { Db } from 'mongodb';
import type { CostPoJobData } from '@mercury/core';

export type { CostPoJobData };

export async function handleCostPo(job: Job<CostPoJobData>, _db: Db): Promise<void> {
  // Cost/PO creation is handled synchronously by POST /costs in the API (B5).
  // This queue entry exists for future async PO generation (e.g. PDF rendering, B5+).
  job.log(
    `[cost-po] projectId=${job.data.projectId} billableWords=${job.data.billableWords} — handled by API`,
  );
}
