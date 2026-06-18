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

// Uncomment and install kafkajs when ready:
// import { Kafka, Producer } from 'kafkajs';

export class KafkaBroker implements MessageBroker {
  // private producer: Producer;

  constructor(_brokers: string[]) {
    // const kafka = new Kafka({ clientId: 'mercury-api', brokers });
    // this.producer = kafka.producer();
    // await this.producer.connect();
    throw new Error('KafkaBroker: install kafkajs and uncomment implementation');
  }

  async enqueueTranslate(data: TranslateJobData): Promise<void> {
    await this.publish('mercury.translate', data);
  }

  async enqueueWebhook(data: WebhookJobData): Promise<void> {
    await this.publish('mercury.webhook', data);
  }

  async enqueueCostPo(data: CostPoJobData): Promise<void> {
    await this.publish('mercury.cost-po', data);
  }

  private async publish(topic: string, value: unknown): Promise<void> {
    // await this.producer.send({ topic, messages: [{ value: JSON.stringify(value) }] });
    void topic; void value;
    throw new Error('KafkaBroker: not yet implemented');
  }
}
