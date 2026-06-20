/**
 * Translation pipeline expressed as discrete, pure-async activity functions.
 *
 * TODAY  — called sequentially by the BullMQ translation worker.
 * FUTURE — each function becomes a Temporal Activity decorated with proxyActivities():
 *
 *   import { proxyActivities } from '@temporalio/workflow';
 *   import type * as acts from './translation';
 *   const { fetchProjectAndJob, segmentJob, translateMisses,
 *           persistSegments, finaliseJob, fireJobCallbacks } =
 *     proxyActivities<typeof acts>({ startToCloseTimeout: '10 minutes' });
 *
 * Each activity gets independent retry, timeout, and visibility in the Temporal UI.
 * The workflow can compensate (roll back) on partial failures.
 */
import { Db } from 'mongodb';
import { Segmenter } from '../index.js';
import type { Project, Job } from '../types/domain.js';
import type { MessageBroker } from '../ports/MessageBroker.js';
export declare function fetchProjectAndJob(db: Db, projectId: number, jobId: number): Promise<{
    project: Project;
    job: Job;
}>;
export interface ExtractedResult {
    segments: ReturnType<typeof Segmenter.extract>;
    sourceContent: Record<string, unknown>;
}
export declare function segmentJob(job: Job): Promise<ExtractedResult>;
export declare function translateMisses(misses: ReturnType<typeof Segmenter.extract>, sourceLanguage: string, targetLanguage: string): Promise<Map<string, string>>;
export interface PersistResult {
    billableWords: number;
    targetMap: Map<string, string>;
}
export declare function persistSegments(db: Db, jobId: number, projectId: number, segments: ReturnType<typeof Segmenter.extract>, tmHits: Map<string, string>, mtTranslations: Map<string, string>): Promise<PersistResult>;
export declare function finaliseJob(db: Db, jobId: number, projectId: number, sourceContent: Record<string, unknown>, segments: ReturnType<typeof Segmenter.extract>, targetMap: Map<string, string>, billableWords: number): Promise<void>;
export declare function fireJobCallbacks(db: Db, broker: MessageBroker, project: Project, jobId: number): Promise<void>;
export declare function persistHumanSegments(db: Db, jobId: number, projectId: number, segments: ReturnType<typeof Segmenter.extract>): Promise<void>;
