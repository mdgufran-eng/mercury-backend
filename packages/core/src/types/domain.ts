export type XTMActivity =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'AUTO_ARCHIVED'
  | 'DELETED'
  | 'INACTIVE'
  | 'ACTIVATING'
  | 'ARCHIVING'
  | 'AUTO_ARCHIVING'
  | 'MARKED_FOR_ACTIVATION';

export type ProjectStatus = 'CREATED' | 'ACTIVE' | 'IN_PROGRESS' | 'FINISHED' | 'FAILED';
export type TranslationMethod = 'MACHINE' | 'HUMAN';
export type SegmentMatchType = 'ICE' | 'MT';
export type SegmentState = 'PENDING' | 'TRANSLATED' | 'APPROVED' | 'REJECTED';
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
  projectId: number;
  name: string;
  customerId: number;
  templateId: number;
  sourceLanguage: string;
  targetLanguage: string;
  method: TranslationMethod;
  status: ProjectStatus;
  activity: XTMActivity;
  completionStatus?: string;
  referenceId?: string;
  description?: string;
  freelancerId?: number;
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
  sourceFileKey: string;
  targetFileKey?: string;
  status: JobStatus;
  wordCount: number;
  billableWords: number;
  sourceHash: string;
  sourceContent?: Record<string, unknown>;
  targetContent?: Record<string, unknown>;
  segmentCache?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Segment {
  _id?: string;
  segmentId: number;
  jobId: number;
  projectId: number;
  index: number;
  fieldKey: string;
  source: string;
  target?: string;
  sourceHash: string;
  matchType?: SegmentMatchType;
  state: SegmentState;
  approved: boolean;
  locked: boolean;
  tags: Record<string, string>;
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
  origin?: 'APPROVED' | 'IMPORTED_TMX';
  createdAt: Date;
}

export interface CallbackLog {
  _id?: string;
  callbackId: number;
  projectId: number;
  jobId?: number;
  event: CallbackEvent;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
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
  type?: 'HUMAN' | 'MACHINE' | 'PAYLOAD';
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
  ratePerWord: number;
  currency: string;
  createdAt: Date;
}

export interface Cost {
  _id?: string;
  costId: number;
  projectId: number;
  jobId?: number;
  freelancerId?: number;
  vendorFirstName?: string;
  vendorLastName?: string;
  totalWords: number;
  billableWords: number;
  ratePerWord: number;
  amount: number;
  currency: string;
  createdAt: Date;
}

export interface PurchaseOrder {
  _id?: string;
  poId: number;
  costId: number;
  projectId: number;
  freelancerId?: number;
  vendorName: string;
  amount: number;
  currency: string;
  processId: string;
  createdAt: Date;
}

export interface Counter {
  _id: string;
  seq: number;
}