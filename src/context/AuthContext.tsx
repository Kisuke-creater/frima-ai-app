"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { clearAuthTokenCookie, getAuthTokenFromCookie } from "@/lib/auth-cookie";
import {
  AuthUser,
  getUserFromAccessToken,
  signOutWithAccessToken,
} from "@/lib/supabase-auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const token = getAuthTokenFromCookie();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const nextUser = await getUserFromAccessToken(token);
      setUser(nextUser);
      return nextUser;
    } catch {
      clearAuthTokenCookie();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = async () => {
    const token = getAuthTokenFromCookie();
    if (token) {
      try {
        await signOutWithAccessToken(token);
      } catch {
        // Ignore sign-out API errors and clear local session regardless.
      }
    }
    clearAuthTokenCookie();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
