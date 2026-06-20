import { Db } from 'mongodb';
export declare const TM_WORD_LIMIT = 20;
export declare const INLINE_TAG_RE: RegExp;
export declare function sourceHash(text: string): string;
export declare function batchLookup(db: Db, segments: Array<{
    id: string;
    text: string;
}>, srcLang: string, tgtLang: string): Promise<Map<string, string>>;
export declare function store(db: Db, sourceText: string, targetText: string, srcLang: string, tgtLang: string, origin?: 'APPROVED' | 'IMPORTED_TMX'): Promise<void>;
export declare function bulkUpsert(db: Db, entries: Array<{
    sourceText: string;
    targetText: string;
    sourceHash: string;
}>, srcLang: string, tgtLang: string): Promise<void>;
export declare function count(db: Db, srcLang: string, tgtLang: string): Promise<number>;
