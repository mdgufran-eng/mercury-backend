import type { TranslateJobData } from '../types/jobPayloads.js';

/**
 * Durable workflow orchestrator.
 * Current implementation: BullMQ (one job = one workflow step).
 * Swap to Temporal by providing a TemporalWorkflowRunner that implements this.
 *
 * Temporal benefits over BullMQ for the translation pipeline:
 * - Built-in saga / compensation
 * - Per-activity retry + timeout configuration
 * - Full execution history visible in the Temporal UI
 * - Workers can crash mid-pipeline and resume from the last completed activity
 */
export interface WorkflowRunner {
  startTranslation(data: TranslateJobData): Promise<void>;
}
