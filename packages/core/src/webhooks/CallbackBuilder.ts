export interface WebhookRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
}

export function buildProjectCreatedWebhook(callbackUrl: string, projectId: number): WebhookRequest {
  const url = new URL(callbackUrl);
  url.searchParams.set('xtmProjectId', String(projectId));
  return {
    method: 'POST',
    url: url.toString(),
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    contentType: 'application/json',
  };
}

export function buildAnalysisFinishedWebhook(callbackUrl: string, projectId: number): WebhookRequest {
  return {
    method: 'POST',
    url: callbackUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `xtmProjectId=${projectId}`,
    contentType: 'application/x-www-form-urlencoded',
  };
}

export function buildJobFinishedWebhook(
  callbackUrl: string,
  projectId: number,
  jobId: number,
  customerId: number,
  translatedContent?: unknown,
): WebhookRequest {
  const url = new URL(callbackUrl);
  url.searchParams.set('xtmJobId', String(jobId));
  url.searchParams.set('xtmProjectId', String(projectId));
  url.searchParams.set('xtmCustomerId', String(customerId));
  if (translatedContent !== undefined) {
    return {
      method: 'POST',
      url: url.toString(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xtmProjectId: projectId, xtmJobId: jobId, xtmCustomerId: customerId, translatedContent }),
    };
  }
  return {
    method: 'GET',
    url: url.toString(),
  };
}

export function buildProjectCompletionWebhook(
  callbackUrl: string,
  projectId: number,
  customerId: number,
): WebhookRequest {
  const url = new URL(callbackUrl);
  url.searchParams.set('xtmProjectId', String(projectId));
  url.searchParams.set('xtmCustomerId', String(customerId));
  return {
    method: 'GET',
    url: url.toString(),
  };
}

export function buildSourceFileUpdatedWebhook(callbackUrl: string, projectId: number): WebhookRequest {
  const url = new URL(callbackUrl);
  url.searchParams.set('xtmProjectId', String(projectId));
  return {
    method: 'POST',
    url: url.toString(),
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    contentType: 'application/json',
  };
}

export function buildActivityChangedWebhook(
  callbackUrl: string,
  projectId: number,
  activity: string,
): WebhookRequest {
  const url = new URL(callbackUrl);
  url.searchParams.set('xtmProjectId', String(projectId));
  return {
    method: 'POST',
    url: url.toString(),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify({ activity })),
    contentType: 'application/json',
  };
}