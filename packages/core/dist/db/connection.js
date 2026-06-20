"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongo = connectMongo;
exports.closeMongo = closeMongo;
exports.getDb = getDb;
const mongodb_1 = require("mongodb");
let client = null;
let db = null;
async function connectMongo(uri) {
    if (db)
        return db;
    const connectionUri = uri ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/mercury';
    client = new mongodb_1.MongoClient(connectionUri);
    await client.connect();
    const url = new URL(connectionUri);
    const dbName = url.pathname.replace(/^\//, '') || 'mercury';
    db = client.db(dbName);
    return db;
}
async function closeMongo() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
function getDb() {
    if (!db) {
        throw new Error('MongoDB not connected. Call connectMongo() first.');
    }
    return db;
}
