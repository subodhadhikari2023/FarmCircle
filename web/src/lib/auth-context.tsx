"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { API_URL, parseApiError } from "./api";

export type Role = "GROWER" | "VENDOR" | "CUSTOMER" | "ADMIN";

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
  login: (email: string, password: string) => Promise<Me>;
  register: (params: RegisterParams) => Promise<Me>;
  logout: () => Promise<void>;
  setSessionFromToken: (accessToken: string) => Promise<Me | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh this long before the access token's actual expiry, so a click
// that lands right at the boundary doesn't race the token going stale.
const REFRESH_BUFFER_MS = 15_000;

function decodeTokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
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
      return null;
    }
    const me = (await res.json()) as Me;
    setAccessToken(token);
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      const { accessToken: token } = (await res.json()) as {
        accessToken: string;
      };
      await establishSession(token);
    } catch {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [establishSession]);

  useEffect(() => {
    void (async () => {
      await silentRefresh();
    })();
  }, [silentRefresh]);

  // Access tokens are short-lived and only ever live in memory, so without
  // this, any authenticated action taken after the token expires (e.g.
  // clicking "Log out" a couple minutes after logging in) would silently
  // 401. Re-refresh in the background shortly before each token expires.
  useEffect(() => {
    if (!accessToken) return;
    const expiresAtMs = decodeTokenExpiryMs(accessToken);
    if (expiresAtMs === null) return;

    const delay = Math.max(expiresAtMs - Date.now() - REFRESH_BUFFER_MS, 0);
    const timer = setTimeout(() => void silentRefresh(), delay);
    return () => clearTimeout(timer);
  }, [accessToken, silentRefresh]);

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
      const me = await establishSession(token);
      if (!me) throw new Error("Signed in, but couldn't load your account.");
      return me;
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
        return await login(params.email, params.password);
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
