"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { API_URL } from "./api";

type Role = "GROWER" | "VENDOR" | "CUSTOMER" | "ADMIN";

export type Me = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type RegisterParams = {
  name: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "VENDOR";
};

type AuthContextValue = {
  user: Me | null;
  status: AuthStatus;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
  setSessionFromToken: (accessToken: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // response wasn't JSON — fall through to the generic message
  }
  return "Something went wrong. Please try again.";
}

async function fetchOrThrow(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(
      "Can't reach the server. Check your connection and try again.",
    );
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const establishSession = useCallback(async (token: string) => {
    const res = await fetchOrThrow(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
      return;
    }
    setAccessToken(token);
    setUser((await res.json()) as Me);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setStatus("unauthenticated");
          return;
        }
        const { accessToken: token } = (await res.json()) as {
          accessToken: string;
        };
        await establishSession(token);
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [establishSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetchOrThrow(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const { accessToken: token } = (await res.json()) as {
        accessToken: string;
      };
      await establishSession(token);
    },
    [establishSession],
  );

  const register = useCallback(
    async (params: RegisterParams) => {
      const res = await fetchOrThrow(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      try {
        await login(params.email, params.password);
      } catch {
        throw new Error(
          "Account created, but signing you in automatically failed. Try logging in.",
        );
      }
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } catch {
      // best-effort — local state below is cleared either way
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        accessToken,
        login,
        register,
        logout,
        setSessionFromToken: establishSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
