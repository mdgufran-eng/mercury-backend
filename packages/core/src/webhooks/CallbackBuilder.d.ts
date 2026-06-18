export interface WebhookRequest {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    body?: string;
    contentType?: string;
}
export declare function buildProjectCreatedWebhook(callbackUrl: string, projectId: number): WebhookRequest;
export declare function buildAnalysisFinishedWebhook(callbackUrl: string, projectId: number): WebhookRequest;
export declare function buildJobFinishedWebhook(callbackUrl: string, projectId: number, jobId: number, customerId: number): WebhookRequest;
export declare function buildProjectCompletionWebhook(callbackUrl: string, projectId: number, customerId: number): WebhookRequest;
export declare function buildSourceFileUpdatedWebhook(callbackUrl: string, projectId: number): WebhookRequest;
export declare function buildActivityChangedWebhook(callbackUrl: string, projectId: number, activity: string): WebhookRequest;
