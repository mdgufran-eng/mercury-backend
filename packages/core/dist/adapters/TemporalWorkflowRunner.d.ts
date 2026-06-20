/**
 * Temporal implementation of WorkflowRunner.
 *
 * To activate:
 *   npm install @temporalio/client --workspace=packages/core
 *   npm install @temporalio/worker @temporalio/workflow @temporalio/activity --workspace=apps/worker
 *   Set WORKFLOW_RUNNER=temporal + TEMPORAL_ADDRESS=localhost:7233 in env
 *
 * Each step in translationActivities (workflows/translation.ts) maps 1:1 to a Temporal Activity.
 * The workflow orchestrates them with per-activity retry/timeout config.
 *
 * Worker setup:
 *   const worker = await Worker.create({
 *     workflowsPath: require.resolve('./workflows/translation'),
 *     activities: translationActivities,
 *     taskQueue: 'mercury-translation',
 *   });
 */
import type { WorkflowRunner } from '../ports/WorkflowRunner.js';
import type { TranslateJobData } from '../types/jobPayloads.js';
export declare class TemporalWorkflowRunner implements WorkflowRunner {
    constructor(_address?: string);
    startTranslation(data: TranslateJobData): Promise<void>;
}
