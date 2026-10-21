import { pgTable, text, timestamp, serial, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A speaker session. `code` is the speaker's (uppercased) speaker code and is
 * what listeners join with; multiple sessions can share a code over time, so
 * `id` is the stable unique key.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    userId: text("user_id"),
    fromLang: text("from_lang").notNull(),
    toLang: text("to_lang").notNull(),
    fromLangName: text("from_lang_name").notNull(),
    toLangName: text("to_lang_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    codeIdx: index("sessions_code_idx").on(t.code),
    userIdx: index("sessions_user_idx").on(t.userId),
  })
);

export const insertSessionSchema = createInsertSchema(sessionsTable);
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type SessionRow = typeof sessionsTable.$inferSelect;

export const translationsTable = pgTable(
  "translations",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    original: text("original").notNull(),
    translated: text("translated").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("translations_session_idx").on(t.sessionId),
  })
);

export const insertTranslationSchema = createInsertSchema(translationsTable);
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type TranslationRow = typeof translationsTable.$inferSelect;
