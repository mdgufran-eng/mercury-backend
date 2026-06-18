export interface TranslateJobData {
  projectId: number;
  jobId: number;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface WebhookJobData {
  callbackId: number;
  projectId: number;
  jobId?: number;
  event: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  customerId?: number;
}

export interface CostPoJobData {
  projectId: number;
  billableWords: number;
  ratePerWord?: number;
  currency?: string;
}