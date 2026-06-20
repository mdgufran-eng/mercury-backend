import { Readable } from 'stream';
/**
 * Buffer the TMX stream and forward to the ML service for import.
 * The ML service owns TM storage and does its own streaming parse internally.
 *
 * For very large files (700 MB+) the ML service should ideally accept
 * chunked streaming — for v1 we buffer here and send as one request.
 */
export declare function importTmx(stream: Readable, sourceLang: string, targetLang: string): Promise<{
    imported: number;
    skipped: number;
}>;
