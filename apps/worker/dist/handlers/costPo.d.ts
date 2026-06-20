import { Job } from 'bullmq';
import { Db } from 'mongodb';
import type { CostPoJobData } from '@mercury/core';
export type { CostPoJobData };
export declare function handleCostPo(job: Job<CostPoJobData>, _db: Db): Promise<void>;
