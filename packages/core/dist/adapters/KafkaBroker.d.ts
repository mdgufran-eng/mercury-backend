/**
 * Kafka implementation of MessageBroker.
 *
 * To activate:
 *   npm install kafkajs --workspace=packages/core
 *   Set BROKER=kafka + KAFKA_BROKERS=host:9092 in env
 *   Implement a KafkaWorker that subscribes to each topic and calls the same handler functions.
 *
 * Topic naming convention:
 *   mercury.translate   → TranslateJobData
 *   mercury.webhook     → WebhookJobData
 *   mercury.cost-po     → CostPoJobData
 */
import type { MessageBroker } from '../ports/MessageBroker.js';
import type { TranslateJobData, WebhookJobData, CostPoJobData } from '../types/jobPayloads.js';
export declare class KafkaBroker implements MessageBroker {
    constructor(_brokers: string[]);
    enqueueTranslate(data: TranslateJobData): Promise<void>;
    enqueueWebhook(data: WebhookJobData): Promise<void>;
    enqueueCostPo(data: CostPoJobData): Promise<void>;
    private publish;
}
