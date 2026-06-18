import type { WorkflowRunner } from '../ports/WorkflowRunner.js';
import type { MessageBroker } from '../ports/MessageBroker.js';
import type { TranslateJobData } from '../types/jobPayloads.js';

/**
 * WorkflowRunner backed by BullMQ — each "workflow" is a single queued job.
 * Swap for TemporalWorkflowRunner when you want durable multi-step workflows.
 */
export class BullMQWorkflowRunner implements WorkflowRunner {
  constructor(private broker: MessageBroker) {}

  async startTranslation(data: TranslateJobData): Promise<void> {
    await this.broker.enqueueTranslate(data);
  }
}
