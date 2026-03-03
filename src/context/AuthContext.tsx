"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";

import { clearAuthTokenCookie, setAuthTokenCookie } from "@/lib/auth-cookie";
import {
  AuthUser,
  getCurrentSession,
  signOutCurrentUser,
  subscribeAuthUser,
} from "@/lib/firebase-auth";

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
    const session = await getCurrentSession();
    if (!session) {
      clearAuthTokenCookie();
      setUser(null);
      return null;
    }

    setAuthTokenCookie(session.accessToken, session.expiresIn);
    setUser(session.user);
    return session.user;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAuthUser((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        clearAuthTokenCookie();
      } else {
        void getCurrentSession().then((session) => {
          if (session) {
            setAuthTokenCookie(session.accessToken, session.expiresIn);
          }
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOutCurrentUser().catch(() => {
      // Ignore API errors and clear local session regardless.
    });
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
