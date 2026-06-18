import { Collection, Db } from 'mongodb';
import type {
  Project,
  Job,
  Segment,
  CallbackLog,
  Customer,
  Template,
  Freelancer,
  Counter,
  Cost,
  PurchaseOrder,
} from '../types/domain.js';

export function projects(db: Db): Collection<Project> {
  return db.collection<Project>('projects');
}

export function jobs(db: Db): Collection<Job> {
  return db.collection<Job>('jobs');
}

export function segments(db: Db): Collection<Segment> {
  return db.collection<Segment>('segments');
}


export function callbackLogs(db: Db): Collection<CallbackLog> {
  return db.collection<CallbackLog>('callbackLogs');
}

export function customers(db: Db): Collection<Customer> {
  return db.collection<Customer>('customers');
}

export function templates(db: Db): Collection<Template> {
  return db.collection<Template>('templates');
}

export function freelancers(db: Db): Collection<Freelancer> {
  return db.collection<Freelancer>('freelancers');
}

export function counters(db: Db): Collection<Counter> {
  return db.collection<Counter>('counters');
}

export function costs(db: Db): Collection<Cost> {
  return db.collection<Cost>('costs');
}

export function purchaseOrders(db: Db): Collection<PurchaseOrder> {
  return db.collection<PurchaseOrder>('purchaseOrders');
}