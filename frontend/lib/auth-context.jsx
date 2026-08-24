"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    try {
      const { user } = await api.get("/auth/me");
      setUser(user);
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const hasToken = typeof window !== "undefined" && window.localStorage.getItem("lg_token");
    if (!hasToken) {
      setLoading(false);
      return;
    }
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const { token, user } = await api.post("/auth/login", { email, password });
    setToken(token);
    setUser(user);
    router.push("/dashboard");
  }

  async function signup(name, email, password) {
    const { token, user } = await api.post("/auth/signup", { name, email, password });
    setToken(token);
    setUser(user);
    router.push("/dashboard");
  }

  function logout() {
    setToken(null);
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, signup, logout, refresh: loadMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
