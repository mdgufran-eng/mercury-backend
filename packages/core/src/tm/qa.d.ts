export interface QAError {
    code: string;
    message: string;
}
export interface QAResult {
    passed: boolean;
    errors: QAError[];
}
export declare function runQA(source: string, target: string): QAResult;
