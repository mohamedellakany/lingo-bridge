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
  : "http://localhost:8080";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  speakerCode: string;
  createdAt: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  // Sign in / auto-register using a verified Google ID token.
  loginWithGoogle: (idToken: string) => Promise<{ error?: string }>;
  // Step 1 of signup: sends an OTP to the email. On success the caller moves
  // to the verification step. Does NOT log the user in yet.
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ error?: string; pending?: boolean }>;
  // Step 2 of signup: verifies the emailed code and logs the user in.
  verifyOtp: (username: string, code: string) => Promise<{ error?: string }>;
  resendOtp: (username: string) => Promise<{ error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
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

  const loginWithGoogle = useCallback(
    async (idToken: string): Promise<{ error?: string }> => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = (await resp.json()) as {
          user?: AuthUser;
          token?: string;
          error?: string;
        };
        if (!resp.ok || data.error) {
          return { error: data.error ?? "Google sign-in failed" };
        }
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
    async (
      username: string,
      email: string,
      password: string
    ): Promise<{ error?: string; pending?: boolean }> => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const data = (await resp.json()) as {
          pending?: boolean;
          error?: string;
        };
        if (!resp.ok || data.error) {
          return { error: data.error ?? "Registration failed" };
        }
        return { pending: true };
      } catch {
        return { error: "Network error. Please try again." };
      }
    },
    []
  );

  const verifyOtp = useCallback(
    async (username: string, code: string): Promise<{ error?: string }> => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, code }),
        });
        const data = (await resp.json()) as {
          user?: AuthUser;
          token?: string;
          error?: string;
        };
        if (!resp.ok || data.error) {
          return { error: data.error ?? "Verification failed" };
        }
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

  const resendOtp = useCallback(
    async (username: string): Promise<{ error?: string }> => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/resend-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = (await resp.json()) as { ok?: boolean; error?: string };
        if (!resp.ok || data.error) {
          return { error: data.error ?? "Could not resend the code" };
        }
        return {};
      } catch {
        return { error: "Network error. Please try again." };
      }
    },
    []
  );

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ error?: string }> => {
      if (!token) return { error: "Not authenticated" };
      try {
        const resp = await fetch(`${API_BASE}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = (await resp.json()) as { ok?: boolean; error?: string };
        if (!resp.ok || data.error) {
          return { error: data.error ?? "Could not change password" };
        }
        return {};
      } catch {
        return { error: "Network error. Please try again." };
      }
    },
    [token]
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

  const deleteAccount = useCallback(async (): Promise<{ error?: string }> => {
    if (!token) return { error: "Not authenticated" };
    try {
      const resp = await fetch(`${API_BASE}/api/auth/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || data.error) {
        return { error: data.error ?? "Could not delete account" };
      }
      // Clear local session after successful deletion.
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      setUser(null);
      setToken(null);
      return {};
    } catch {
      return { error: "Network error. Please try again." };
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        loginWithGoogle,
        register,
        verifyOtp,
        resendOtp,
        changePassword,
        deleteAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
