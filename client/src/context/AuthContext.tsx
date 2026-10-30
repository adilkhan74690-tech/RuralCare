import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  villageSector: string;
  phoneNumber?: string;
  token?: string;
  loginTime: string;
}

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string, remember: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const stored = localStorage.getItem('ruralcare_auth_session') || sessionStorage.getItem('ruralcare_auth_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Verify token on boot if online
  useEffect(() => {
    if (user?.token && navigator.onLine) {
      fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
        .then((res) => {
          if (!res.ok) {
            console.warn('[Auth] Session token expired or revoked.');
            logout();
          }
        })
        .catch((err) => {
          // If offline or network drop, keep local session intact
          console.log('[Auth] Network check skipped; preserving offline session:', err.message);
        });
    }
  }, []);

  const login = async (email: string, pass: string, remember: boolean): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Please enter both your email and password.' };
    }

    // 1. Online Authentication against PostgreSQL backend
    if (navigator.onLine) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          return { success: false, error: data.error || 'Invalid credentials. Please verify your email and password.' };
        }

        const session: UserSession = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          villageSector: data.user.villageSector,
          phoneNumber: data.user.phoneNumber,
          token: data.token,
          loginTime: new Date().toISOString(),
        };

        setUser(session);

        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('ruralcare_auth_session', JSON.stringify(session));

        // Cache verified credentials for offline field re-authentication
        try {
          const offlineAccountsStr = localStorage.getItem('ruralcare_offline_accounts');
          const offlineAccounts: Record<string, { session: UserSession; passHash: string }> = offlineAccountsStr
            ? JSON.parse(offlineAccountsStr)
            : {};

          // Store a simple hash for local offline verification
          let hash = 0;
          for (let i = 0; i < cleanPass.length; i++) {
            hash = (hash << 5) - hash + cleanPass.charCodeAt(i);
            hash |= 0;
          }

          offlineAccounts[cleanEmail] = {
            session,
            passHash: String(hash),
          };
          localStorage.setItem('ruralcare_offline_accounts', JSON.stringify(offlineAccounts));
        } catch (e) {
          console.warn('[Auth] Could not cache offline credentials:', e);
        }

        return { success: true };
      } catch (err: any) {
        console.warn('[Auth] Network request failed; checking offline credentials cache:', err.message);
      }
    }

    // 2. Offline Field Authentication fallback
    try {
      const offlineAccountsStr = localStorage.getItem('ruralcare_offline_accounts');
      if (offlineAccountsStr) {
        const offlineAccounts = JSON.parse(offlineAccountsStr);
        const account = offlineAccounts[cleanEmail];

        if (account) {
          let hash = 0;
          for (let i = 0; i < cleanPass.length; i++) {
            hash = (hash << 5) - hash + cleanPass.charCodeAt(i);
            hash |= 0;
          }

          if (account.passHash === String(hash)) {
            setUser(account.session);
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('ruralcare_auth_session', JSON.stringify(account.session));
            console.log('[Auth] Authenticated in Offline Mode using cached credentials.');
            return { success: true };
          }
        }
      }
    } catch {
      // ignore
    }

    return {
      success: false,
      error: navigator.onLine
        ? 'Invalid email or password.'
        : 'Cannot authenticate while offline. Please connect once to verify credentials, or enter previously verified credentials.',
    };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ruralcare_auth_session');
    sessionStorage.removeItem('ruralcare_auth_session');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
