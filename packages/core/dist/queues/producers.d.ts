import { ConnectionOptions } from 'bullmq';
import type { TranslateJobData } from '../types/jobPayloads.js';
import type { WebhookJobData } from '../types/jobPayloads.js';
import type { CostPoJobData } from '../types/jobPayloads.js';
export type { TranslateJobData, WebhookJobData, CostPoJobData };
export declare function enqueueTranslate(connection: ConnectionOptions, data: TranslateJobData): Promise<void>;
export declare function enqueueWebhook(connection: ConnectionOptions, data: WebhookJobData): Promise<void>;
export declare function enqueueCostPo(connection: ConnectionOptions, data: CostPoJobData): Promise<void>;
