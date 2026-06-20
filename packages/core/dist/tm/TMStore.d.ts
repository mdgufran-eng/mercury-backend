import * as ML from '../ml/MLServiceClient.js';
export type { TmHit } from '../ml/MLServiceClient.js';
export declare function lookupBatch(segments: Array<{
    id: string;
    text: string;
}>, sourceLang: string, targetLang: string): Promise<Map<string, ML.TmHit>>;
export declare function upsert(opts: {
    sourceText: string;
    targetText: string;
    origin: 'APPROVED' | 'IMPORTED_TMX';
    sourceLang: string;
    targetLang: string;
}): Promise<void>;
