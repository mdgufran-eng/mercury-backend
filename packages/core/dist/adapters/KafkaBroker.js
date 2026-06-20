"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaBroker = void 0;
// Uncomment and install kafkajs when ready:
// import { Kafka, Producer } from 'kafkajs';
class KafkaBroker {
    // private producer: Producer;
    constructor(_brokers) {
        // const kafka = new Kafka({ clientId: 'mercury-api', brokers });
        // this.producer = kafka.producer();
        // await this.producer.connect();
        throw new Error('KafkaBroker: install kafkajs and uncomment implementation');
    }
    async enqueueTranslate(data) {
        await this.publish('mercury.translate', data);
    }
    async enqueueWebhook(data) {
        await this.publish('mercury.webhook', data);
    }
    async enqueueCostPo(data) {
        await this.publish('mercury.cost-po', data);
    }
    async publish(topic, value) {
        // await this.producer.send({ topic, messages: [{ value: JSON.stringify(value) }] });
        void topic;
        void value;
        throw new Error('KafkaBroker: not yet implemented');
    }
}
exports.KafkaBroker = KafkaBroker;
