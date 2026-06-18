import type { TranslateJobData, WebhookJobData, CostPoJobData } from '../types/jobPayloads.js';
/**
 * Transport-agnostic message broker.
 * Current implementation: BullMQ (adapters/BullMQBroker.ts).
 * Swap to Kafka by providing a KafkaBroker that implements this interface.
 */
export interface MessageBroker {
    enqueueTranslate(data: TranslateJobData): Promise<void>;
    enqueueWebhook(data: WebhookJobData): Promise<void>;
    enqueueCostPo(data: CostPoJobData): Promise<void>;
}
