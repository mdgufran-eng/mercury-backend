export interface ExtractedSegment {
    id: string;
    fieldKey: string;
    sentenceIndex: number;
    source: string;
    tags: Record<string, string>;
    wordCount: number;
    kind?: 'plain' | 'htmlBlock';
    htmlPath?: number[];
}
declare function expandTags(tagged: string, tags: Record<string, string>): string;
export declare function extract(source: Record<string, unknown>): ExtractedSegment[];
export declare function reassemble(source: Record<string, unknown>, segments: ExtractedSegment[], translations: Map<string, string>): Record<string, unknown>;
export { expandTags };
