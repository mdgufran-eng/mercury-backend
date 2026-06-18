export type ProjectStatus = 'CREATED' | 'ACTIVE' | 'IN_PROGRESS' | 'FINISHED' | 'FAILED';
export type TranslationMethod = 'MACHINE' | 'HUMAN';
export type SegmentMatchType = 'ICE' | 'MT';
export type JobStatus = 'CREATED' | 'IN_PROGRESS' | 'FINISHED' | 'FAILED';
export type CallbackEvent =
  | 'project-created'
  | 'analysis-finished'
  | 'job-finished'
  | 'project-completion'
  | 'source-file-updated'
  | 'project-activity-changed';

export interface Project {
  _id?: string;
  projectId: number;          // numeric, from atomic counter
  name: string;               // rosetta uses name for lookup
  customerId: number;
  templateId: number;
  sourceLanguage: string;
  targetLanguage: string;
  method: TranslationMethod;
  status: ProjectStatus;
  callbackUrls: {
    projectCreated?: string;
    analysisFinished?: string;
    jobFinished?: string;
    projectCompletion?: string;
    sourceFileUpdated?: string;
    projectActivityChanged?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Job {
  _id?: string;
  jobId: number;
  projectId: number;
  fileName: string;
  sourceFileKey: string;       // MinIO object key
  targetFileKey?: string;
  status: JobStatus;
  wordCount: number;
  billableWords: number;       // MT-miss words only
  sourceHash: string;          // SHA-256 of source content
  createdAt: Date;
  updatedAt: Date;
}

export interface Segment {
  _id?: string;
  segmentId: number;
  jobId: number;
  projectId: number;
  index: number;
  source: string;
  target?: string;
  sourceHash: string;
  matchType?: SegmentMatchType;
  approved: boolean;
  locked: boolean;
  tags: string[];              // extracted inline tags {1}{2}
  createdAt: Date;
  updatedAt: Date;
}

export interface TMEntry {
  _id?: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceHash: string;
  sourceText: string;
  targetText: string;
  createdAt: Date;
}

export interface CallbackLog {
  _id?: string;
  callbackId: number;
  projectId: number;
  jobId?: number;
  event: CallbackEvent;
  url: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  attempts: number;
  lastAttemptAt?: Date;
  success: boolean;
  createdAt: Date;
}

export interface Customer {
  _id?: string;
  customerId: number;
  name: string;
  createdAt: Date;
}

export interface Template {
  _id?: string;
  templateId: number;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  method: TranslationMethod;
  createdAt: Date;
}

export interface Freelancer {
  _id?: string;
  freelancerId: number;
  name: string;
  email: string;
  languages: string[];
  createdAt: Date;
}

export interface Counter {
  _id: string;   // e.g. 'projectId', 'jobId', 'segmentId'
  seq: number;
}
