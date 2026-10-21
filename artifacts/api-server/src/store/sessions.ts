import { db, sessionsTable, translationsTable } from "@workspace/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { broadcast } from "../lib/realtime";

export interface Translation {
  id: string;
  original: string;
  translated: string;
  timestamp: number;
}

export interface SessionData {
  id: string;
  code: string;
  userId?: string | null;
  fromLang: string;
  toLang: string;
  fromLangName: string;
  toLangName: string;
  createdAt: number;
  endedAt?: number | null;
  translations: Translation[];
}

const MAX_TRANSLATIONS = 200;

// ── In-memory fallback (used when DATABASE_URL is not configured) ───────────
const memSessions = new Map<string, SessionData>();

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createSession(
  data: Omit<SessionData, "id" | "createdAt" | "translations" | "endedAt">
): Promise<SessionData> {
  const code = data.code.toUpperCase();
  const id = genId();
  const now = Date.now();

  const session: SessionData = {
    id,
    code,
    userId: data.userId ?? null,
    fromLang: data.fromLang,
    toLang: data.toLang,
    fromLangName: data.fromLangName,
    toLangName: data.toLangName,
    createdAt: now,
    endedAt: null,
    translations: [],
  };

  if (db) {
    // End any still-open session with the same code before starting a new one.
    await db
      .update(sessionsTable)
      .set({ endedAt: new Date() })
      .where(and(eq(sessionsTable.code, code), isNull(sessionsTable.endedAt)));

    await db.insert(sessionsTable).values({
      id,
      code,
      userId: data.userId ?? null,
      fromLang: data.fromLang,
      toLang: data.toLang,
      fromLangName: data.fromLangName,
      toLangName: data.toLangName,
      createdAt: new Date(now),
    });
  } else {
    memSessions.set(code, session);
  }

  return session;
}

// ── Read (latest active session for a code, what a listener joins) ──────────

export async function getSession(code: string): Promise<SessionData | undefined> {
  const key = code.toUpperCase();

  if (db) {
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.code, key))
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;

    const translations = await db
      .select()
      .from(translationsTable)
      .where(eq(translationsTable.sessionId, row.id))
      .orderBy(asc(translationsTable.createdAt))
      .limit(MAX_TRANSLATIONS);

    return {
      id: row.id,
      code: row.code,
      userId: row.userId,
      fromLang: row.fromLang,
      toLang: row.toLang,
      fromLangName: row.fromLangName,
      toLangName: row.toLangName,
      createdAt: row.createdAt.getTime(),
      endedAt: row.endedAt ? row.endedAt.getTime() : null,
      translations: translations.map((t) => ({
        id: String(t.id),
        original: t.original,
        translated: t.translated,
        timestamp: t.createdAt.getTime(),
      })),
    };
  }

  return memSessions.get(key);
}

// ── Append a translation + broadcast to listeners ───────────────────────────

export async function addTranslationToSession(
  code: string,
  original: string,
  translated: string
): Promise<Translation | null> {
  const key = code.toUpperCase();

  if (db) {
    const rows = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.code, key))
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);
    const sessionId = rows[0]?.id;
    if (!sessionId) return null;

    const inserted = await db
      .insert(translationsTable)
      .values({ sessionId, original, translated })
      .returning();
    const row = inserted[0];
    if (!row) return null;

    const translation: Translation = {
      id: String(row.id),
      original: row.original,
      translated: row.translated,
      timestamp: row.createdAt.getTime(),
    };
    broadcast(key, { type: "translation", code: key, translation });
    return translation;
  }

  const session = memSessions.get(key);
  if (!session) return null;
  const translation: Translation = {
    id: genId(),
    original,
    translated,
    timestamp: Date.now(),
  };
  session.translations.push(translation);
  if (session.translations.length > MAX_TRANSLATIONS) {
    session.translations = session.translations.slice(-MAX_TRANSLATIONS);
  }
  broadcast(key, { type: "translation", code: key, translation });
  return translation;
}

// ── List a speaker's past sessions (for server-synced history) ──────────────

export async function listSessionsByUser(userId: string): Promise<SessionData[]> {
  if (!db) {
    return [...memSessions.values()].filter((s) => s.userId === userId);
  }
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.createdAt));

  const result: SessionData[] = [];
  for (const row of rows) {
    const translations = await db
      .select()
      .from(translationsTable)
      .where(eq(translationsTable.sessionId, row.id))
      .orderBy(asc(translationsTable.createdAt))
      .limit(MAX_TRANSLATIONS);
    result.push({
      id: row.id,
      code: row.code,
      userId: row.userId,
      fromLang: row.fromLang,
      toLang: row.toLang,
      fromLangName: row.fromLangName,
      toLangName: row.toLangName,
      createdAt: row.createdAt.getTime(),
      endedAt: row.endedAt ? row.endedAt.getTime() : null,
      translations: translations.map((t) => ({
        id: String(t.id),
        original: t.original,
        translated: t.translated,
        timestamp: t.createdAt.getTime(),
      })),
    });
  }
  return result;
}

export async function endSessionByCode(code: string): Promise<void> {
  const key = code.toUpperCase();
  if (db) {
    await db
      .update(sessionsTable)
      .set({ endedAt: new Date() })
      .where(and(eq(sessionsTable.code, key), isNull(sessionsTable.endedAt)));
  } else {
    const s = memSessions.get(key);
    if (s) s.endedAt = Date.now();
  }
  broadcast(key, { type: "ended", code: key });
}
