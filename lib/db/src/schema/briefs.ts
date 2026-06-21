import { pgTable, serial, text, jsonb, timestamp, integer, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const briefSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
});
export type BriefSection = z.infer<typeof briefSectionSchema>;

export const briefsTable = pgTable("briefs", {
  id: serial("id").primaryKey(),
  input: text("input").notNull(),
  mode: text("mode").notNull(), // "ticket-only" | "ticket-and-pr" | "pr-only"
  title: text("title").notNull(),
  sections: jsonb("sections").notNull().$type<BriefSection[]>(),
  jiraKey: text("jira_key"),
  prUrl: text("pr_url"),
  rawJira: text("raw_jira"),
  rawPr: text("raw_pr"),
  jiraContext: text("jira_context"),
  uploadedFiles: jsonb("uploaded_files").$type<{ name: string; content: string }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fileChunksTable = pgTable("file_chunks", {
  id: serial("id").primaryKey(),
  briefId: integer("brief_id").notNull().references(() => briefsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
});

export const insertBriefSchema = createInsertSchema(briefsTable).omit({ id: true, createdAt: true });
export type InsertBrief = z.infer<typeof insertBriefSchema>;
export type Brief = typeof briefsTable.$inferSelect;

export const insertFileChunkSchema = createInsertSchema(fileChunksTable).omit({ id: true });
export type InsertFileChunk = z.infer<typeof insertFileChunkSchema>;
export type FileChunk = typeof fileChunksTable.$inferSelect;
