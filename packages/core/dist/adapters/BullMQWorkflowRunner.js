"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMQWorkflowRunner = void 0;
/**
 * WorkflowRunner backed by BullMQ — each "workflow" is a single queued job.
 * Swap for TemporalWorkflowRunner when you want durable multi-step workflows.
 */
class BullMQWorkflowRunner {
    broker;
    constructor(broker) {
        this.broker = broker;
    }
    async startTranslation(data) {
        await this.broker.enqueueTranslate(data);
    }
}
exports.BullMQWorkflowRunner = BullMQWorkflowRunner;
