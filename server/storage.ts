import { trialResults, type InsertTrialResult, type TrialResult } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

const sqlite = new Database("sqlite.db");
const db = drizzle(sqlite);

export interface IStorage {
  saveTrialResult(result: InsertTrialResult): TrialResult;
  getTrialResults(): TrialResult[];
}

export class DatabaseStorage implements IStorage {
  saveTrialResult(result: InsertTrialResult): TrialResult {
    return db.insert(trialResults).values(result).returning().get();
  }

  getTrialResults(): TrialResult[] {
    return db.select().from(trialResults).all();
  }
}

export const storage = new DatabaseStorage();
