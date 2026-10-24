/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "jobtracker_token";
const USER_STORAGE_KEY = "jobtracker_user";

function decodePayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenUsable(token) {
  const payload = decodePayload(token);
  if (!payload) return false;
  if (!payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && isTokenUsable(saved) ? saved : null;
  });
  const [storedUser, setStoredUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const user = useMemo(() => {
    if (!token) return null;
    if (storedUser && storedUser.role) return storedUser;
    return token ? decodePayload(token) : null;
  }, [token, storedUser]);

  useEffect(() => {
    if (!token) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      if (storedUser) setStoredUser(null);
      return;
    }
    localStorage.setItem(STORAGE_KEY, token);
    if (storedUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(storedUser));
    }
  }, [token, storedUser]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === "admin",
      login: (authData) => {
        const nextToken = typeof authData === "string" ? authData : authData?.token;
        if (!nextToken || !isTokenUsable(nextToken)) {
          setToken(null);
          setStoredUser(null);
          return;
        }
        setToken(nextToken);
        const nextUser = typeof authData === "string" ? decodePayload(nextToken) : authData?.user || decodePayload(nextToken);
        setStoredUser(nextUser || null);
      },
      logout: () => {
        setToken(null);
        setStoredUser(null);
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
