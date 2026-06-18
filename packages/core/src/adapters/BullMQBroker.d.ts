import { type ConnectionOptions } from 'bullmq';
import type { MessageBroker } from '../ports/MessageBroker.js';
import type { TranslateJobData, WebhookJobData, CostPoJobData } from '../types/jobPayloads.js';
export declare class BullMQBroker implements MessageBroker {
    private conn;
    constructor(conn: ConnectionOptions);
    enqueueTranslate(data: TranslateJobData): Promise<void>;
    enqueueWebhook(data: WebhookJobData): Promise<void>;
    enqueueCostPo(data: CostPoJobData): Promise<void>;
    private add;
}
