import { Db } from 'mongodb';
export declare function connectMongo(uri?: string): Promise<Db>;
export declare function closeMongo(): Promise<void>;
export declare function getDb(): Db;
