"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemporalWorkflowRunner = void 0;
// Uncomment and install @temporalio/client when ready:
// import { Client, Connection } from '@temporalio/client';
// import type { translationWorkflow } from '../workflows/translation.js';
class TemporalWorkflowRunner {
    // private client: Client;
    constructor(_address = 'localhost:7233') {
        // const conn = await Connection.connect({ address });
        // this.client = new Client({ connection: conn });
        throw new Error('TemporalWorkflowRunner: install @temporalio/client and uncomment implementation');
    }
    async startTranslation(data) {
        // await this.client.workflow.start('translationWorkflow', {
        //   taskQueue: 'mercury-translation',
        //   workflowId: `translate-${data.projectId}-${data.jobId}`,
        //   args: [data],
        // });
        void data;
        throw new Error('TemporalWorkflowRunner: not yet implemented');
    }
}
exports.TemporalWorkflowRunner = TemporalWorkflowRunner;
