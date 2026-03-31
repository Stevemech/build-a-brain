import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const trialResults = sqliteTable("trial_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stimulusId: text("stimulus_id").notNull(),
  attentionalFocus: real("attentional_focus").notNull(),
  perceptualNoise: real("perceptual_noise").notNull(),
  priorExpectation: real("prior_expectation").notNull(),
  encodingStrength: real("encoding_strength").notNull(),
  retrievalCue: real("retrieval_cue").notNull(),
  perceivedOutput: text("perceived_output").notNull(),
  memoryOutput: text("memory_output").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertTrialResultSchema = createInsertSchema(trialResults).omit({ id: true });
export type InsertTrialResult = z.infer<typeof insertTrialResultSchema>;
export type TrialResult = typeof trialResults.$inferSelect;
