"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projects = projects;
exports.jobs = jobs;
exports.segments = segments;
exports.callbackLogs = callbackLogs;
exports.customers = customers;
exports.templates = templates;
exports.freelancers = freelancers;
exports.counters = counters;
exports.costs = costs;
exports.purchaseOrders = purchaseOrders;
function projects(db) {
    return db.collection('projects');
}
function jobs(db) {
    return db.collection('jobs');
}
function segments(db) {
    return db.collection('segments');
}
function callbackLogs(db) {
    return db.collection('callbackLogs');
}
function customers(db) {
    return db.collection('customers');
}
function templates(db) {
    return db.collection('templates');
}
function freelancers(db) {
    return db.collection('freelancers');
}
function counters(db) {
    return db.collection('counters');
}
function costs(db) {
    return db.collection('costs');
}
function purchaseOrders(db) {
    return db.collection('purchaseOrders');
}
