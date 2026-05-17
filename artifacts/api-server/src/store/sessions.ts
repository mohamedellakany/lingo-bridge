export interface Translation {
  id: string;
  original: string;
  translated: string;
  timestamp: number;
}

export interface SessionData {
  code: string;
  fromLang: string;
  toLang: string;
  fromLangName: string;
  toLangName: string;
  createdAt: number;
  translations: Translation[];
}

const sessions = new Map<string, SessionData>();

export function createSession(
  data: Omit<SessionData, "createdAt" | "translations">
): SessionData {
  const session: SessionData = {
    ...data,
    code: data.code.toUpperCase(),
    createdAt: Date.now(),
    translations: [],
  };
  sessions.set(session.code, session);
  return session;
}

export function getSession(code: string): SessionData | undefined {
  return sessions.get(code.toUpperCase());
}

export function addTranslationToSession(
  code: string,
  original: string,
  translated: string
): Translation | null {
  const session = sessions.get(code.toUpperCase());
  if (!session) return null;
  const translation: Translation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    original,
    translated,
    timestamp: Date.now(),
  };
  session.translations.push(translation);
  if (session.translations.length > 200) {
    session.translations = session.translations.slice(-200);
  }
  return translation;
}
