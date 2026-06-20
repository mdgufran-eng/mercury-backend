/**
 * Redis-backed Translation Memory.
 *
 * Only looks up sentences ≤ TM_WORD_LIMIT words — that's where the hit rate
 * is meaningful (43% for UI strings, 15% for short sentences).
 * Longer sentences go straight to the ML service.
 *
 * Key format: tm:{srcLang}:{tgtLang}:{sha256(normalized_lowercase_source)}
 * Value:      target text (plain string)
 */
import IORedis from 'ioredis';
export declare const TM_WORD_LIMIT = 20;
export declare function lookup(redis: IORedis, source: string, srcLang: string, tgtLang: string): Promise<string | null>;
export declare function batchLookup(redis: IORedis, segments: Array<{
    id: string;
    text: string;
}>, srcLang: string, tgtLang: string): Promise<Map<string, string>>;
export declare function store(redis: IORedis, source: string, target: string, srcLang: string, tgtLang: string): Promise<void>;
export declare function count(redis: IORedis, srcLang: string, tgtLang: string): Promise<number>;
