import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "@lingobridge_sessions";

export interface Translation {
  id: string;
  original: string;
  translated: string;
  timestamp: number;
}

export interface Session {
  code: string;
  fromLang: string;
  toLang: string;
  fromLangName: string;
  toLangName: string;
  createdAt: number;
  endedAt?: number;
  translations: Translation[];
  isActive: boolean;
}

interface SessionContextType {
  sessions: Session[];
  activeSession: Session | null;
  createSpeakerSession: (
    fromLang: string,
    toLang: string,
    fromLangName: string,
    toLangName: string,
    code?: string
  ) => Promise<string>;
  endSession: () => Promise<void>;
  joinSession: (code: string) => Promise<Session | null>;
  addTranslation: (original: string, translated: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  clearActiveSession: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

function generateCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  return `LB-${digits}`;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: Session[] = JSON.parse(data);
        setSessions(parsed);
        return parsed;
      }
      return [] as Session[];
    } catch {
      return [] as Session[];
    }
  }, []);

  const saveSessions = useCallback(async (newSessions: Session[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
      setSessions(newSessions);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSpeakerSession = useCallback(
    async (
      fromLang: string,
      toLang: string,
      fromLangName: string,
      toLangName: string,
      code?: string
    ): Promise<string> => {
      const sessionCode = code ?? generateCode();
      const newSession: Session = {
        code: sessionCode,
        fromLang,
        toLang,
        fromLangName,
        toLangName,
        createdAt: Date.now(),
        translations: [],
        isActive: true,
      };
      const current = await loadSessions();
      const updated = [newSession, ...current];
      await saveSessions(updated);
      setActiveSession(newSession);
      return sessionCode;
    },
    [loadSessions, saveSessions]
  );

  const endSession = useCallback(async () => {
    if (!activeSession) return;
    const current = await loadSessions();
    const updated = current.map((s) =>
      s.code === activeSession.code
        ? { ...s, isActive: false, endedAt: Date.now() }
        : s
    );
    await saveSessions(updated);
    setActiveSession(null);
  }, [activeSession, loadSessions, saveSessions]);

  const joinSession = useCallback(
    async (code: string): Promise<Session | null> => {
      const current = await loadSessions();
      const session = current.find(
        (s) => s.code.toUpperCase() === code.toUpperCase()
      );
      if (session) {
        setActiveSession(session);
        return session;
      }
      return null;
    },
    [loadSessions]
  );

  const addTranslation = useCallback(
    async (original: string, translated: string) => {
      if (!activeSession) return;
      const newTranslation: Translation = {
        id: generateId(),
        original,
        translated,
        timestamp: Date.now(),
      };
      const updatedSession: Session = {
        ...activeSession,
        translations: [...activeSession.translations, newTranslation],
      };
      const current = await loadSessions();
      const updatedSessions = current.map((s) =>
        s.code === activeSession.code ? updatedSession : s
      );
      await saveSessions(updatedSessions);
      setActiveSession(updatedSession);
    },
    [activeSession, loadSessions, saveSessions]
  );

  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSession,
        createSpeakerSession,
        endSession,
        joinSession,
        addTranslation,
        refreshSessions: loadSessions,
        clearActiveSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
