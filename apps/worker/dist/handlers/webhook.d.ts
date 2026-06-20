import { Job } from 'bullmq';
import { Db } from 'mongodb';
import type { WebhookJobData } from '@mercury/core';
export type { WebhookJobData };
export declare function handleWebhook(job: Job<WebhookJobData>, db: Db): Promise<void>;
