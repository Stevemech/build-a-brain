import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertTrialResultSchema } from "@shared/schema";

export function registerRoutes(server: Server, app: Express) {
  app.post("/api/trials", (req, res) => {
    const parsed = insertTrialResultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const result = storage.saveTrialResult(parsed.data);
    res.json(result);
  });

  app.get("/api/trials", (_req, res) => {
    const results = storage.getTrialResults();
    res.json(results);
  });
}
