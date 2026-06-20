"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectCreatedWebhook = buildProjectCreatedWebhook;
exports.buildAnalysisFinishedWebhook = buildAnalysisFinishedWebhook;
exports.buildJobFinishedWebhook = buildJobFinishedWebhook;
exports.buildProjectCompletionWebhook = buildProjectCompletionWebhook;
exports.buildSourceFileUpdatedWebhook = buildSourceFileUpdatedWebhook;
exports.buildActivityChangedWebhook = buildActivityChangedWebhook;
function buildProjectCreatedWebhook(callbackUrl, projectId) {
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
function buildAnalysisFinishedWebhook(callbackUrl, projectId) {
    return {
        method: 'POST',
        url: callbackUrl,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `xtmProjectId=${projectId}`,
        contentType: 'application/x-www-form-urlencoded',
    };
}
function buildJobFinishedWebhook(callbackUrl, projectId, jobId, customerId) {
    const url = new URL(callbackUrl);
    url.searchParams.set('xtmJobId', String(jobId));
    url.searchParams.set('xtmProjectId', String(projectId));
    url.searchParams.set('xtmCustomerId', String(customerId));
    return {
        method: 'GET',
        url: url.toString(),
    };
}
function buildProjectCompletionWebhook(callbackUrl, projectId, customerId) {
    const url = new URL(callbackUrl);
    url.searchParams.set('xtmProjectId', String(projectId));
    url.searchParams.set('xtmCustomerId', String(customerId));
    return {
        method: 'GET',
        url: url.toString(),
    };
}
function buildSourceFileUpdatedWebhook(callbackUrl, projectId) {
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
function buildActivityChangedWebhook(callbackUrl, projectId, activity) {
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
