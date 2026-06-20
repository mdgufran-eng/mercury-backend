import { Job } from 'bullmq';
import { Db } from 'mongodb';
import type { TranslateJobData, MessageBroker } from '@mercury/core';
export type { TranslateJobData };
export declare function handleTranslation(job: Job<TranslateJobData>, db: Db, broker: MessageBroker): Promise<void>;
