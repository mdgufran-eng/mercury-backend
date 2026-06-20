import { Db } from 'mongodb';
export declare function nextId(db: Db, name: string): Promise<number>;
export declare function nextIdRange(db: Db, name: string, count: number): Promise<number[]>;
