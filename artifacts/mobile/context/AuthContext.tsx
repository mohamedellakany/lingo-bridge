import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const TOKEN_KEY = "@lingobridge_auth_token";
const USER_KEY = "@lingobridge_auth_user";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:5000";

export interface AuthUser {
  id: string;
  username: string;
  speakerCode: string;
  createdAt: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          const resp = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (resp.ok) {
            const data = (await resp.json()) as { user: AuthUser };
            setUser(data.user);
            setToken(storedToken);
          } else {
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          }
        }
      } catch {
        // ignore restore errors
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<{ error?: string }> => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = (await resp.json()) as {
          user?: AuthUser;
          token?: string;
          error?: string;
        };
        if (!resp.ok || data.error) return { error: data.error ?? "Login failed" };
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, data.token!),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user!)),
        ]);
        setToken(data.token!);
        setUser(data.user!);
        return {};
      } catch {
        return { error: "Network error. Please try again." };
      }
    },
    []
  );

  const register = useCallback(
    async (username: string, password: string): Promise<{ error?: string }> => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = (await resp.json()) as {
          user?: AuthUser;
          token?: string;
          error?: string;
        };
        if (!resp.ok || data.error) return { error: data.error ?? "Registration failed" };
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, data.token!),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user!)),
        ]);
        setToken(data.token!);
        setUser(data.user!);
        return {};
      } catch {
        return { error: "Network error. Please try again." };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore logout errors
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setUser(null);
    setToken(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
