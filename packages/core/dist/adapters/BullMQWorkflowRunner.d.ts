import type { WorkflowRunner } from '../ports/WorkflowRunner.js';
import type { MessageBroker } from '../ports/MessageBroker.js';
import type { TranslateJobData } from '../types/jobPayloads.js';
/**
 * WorkflowRunner backed by BullMQ — each "workflow" is a single queued job.
 * Swap for TemporalWorkflowRunner when you want durable multi-step workflows.
 */
export declare class BullMQWorkflowRunner implements WorkflowRunner {
    private broker;
    constructor(broker: MessageBroker);
    startTranslation(data: TranslateJobData): Promise<void>;
}
