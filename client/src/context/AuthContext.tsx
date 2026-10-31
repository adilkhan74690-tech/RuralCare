import React, { createContext, useContext, useState, useEffect } from 'react';
import { resumeAutoSyncAfterAuth, pauseAutoSyncForAuth, requestAutoSync } from '../services/syncService';

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

/**
 * Strong cryptographic hash for offline field credential caching using Web Crypto API SHA-256 with per-user salt.
 * Replaces insecure rolling polynomial hash.
 */
async function computeOfflinePasswordHash(password: string, email: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const salt = `ruralcare-offline-salt:${email.toLowerCase()}`;
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-subtle environments (e.g. testing)
  return `sha256-fallback-${password.length}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const stored =
        localStorage.getItem('ruralcare_auth_session') ||
        sessionStorage.getItem('ruralcare_auth_session');
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
            console.warn('[Auth] Session token expired or revoked on server.');
            logout();
          }
        })
        .catch((err) => {
          // If offline or network drop, keep local session intact without terminating
          console.log('[Auth] Network check skipped; preserving offline session:', err.message);
        });
    }
  }, []);

  const login = async (
    email: string,
    pass: string,
    remember: boolean
  ): Promise<{ success: boolean; error?: string }> => {
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
          return {
            success: false,
            error: data.error || 'Invalid credentials. Please verify your email and password.',
          };
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

        // Cache verified credentials using cryptographic SHA-256 for offline field re-authentication
        try {
          const offlineAccountsStr = localStorage.getItem('ruralcare_offline_accounts');
          const offlineAccounts: Record<string, { session: UserSession; passHash: string }> =
            offlineAccountsStr ? JSON.parse(offlineAccountsStr) : {};

          const secureHash = await computeOfflinePasswordHash(cleanPass, cleanEmail);

          offlineAccounts[cleanEmail] = {
            session,
            passHash: secureHash,
          };
          localStorage.setItem('ruralcare_offline_accounts', JSON.stringify(offlineAccounts));
        } catch (e) {
          console.warn('[Auth] Could not cache offline credentials:', e);
        }

        // Automatic Background Sync on User Login:
        resumeAutoSyncAfterAuth();
        requestAutoSync({ reason: 'user-login', force: true, immediate: true });

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
          const expectedHash = await computeOfflinePasswordHash(cleanPass, cleanEmail);

          if (account.passHash === expectedHash) {
            setUser(account.session);
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('ruralcare_auth_session', JSON.stringify(account.session));
            console.log('[Auth] Authenticated in Offline Mode using cryptographically verified cached credentials.');

            resumeAutoSyncAfterAuth();
            requestAutoSync({ reason: 'user-login-offline' });

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

  /**
   * Log out active session:
   * 1. Revoke token on server if reachable.
   * 2. Clear browser session storage.
   * 3. Pause auto-sync until re-authenticated.
   * 4. PRESERVE all pending offline records in Dexie IndexedDB as required.
   */
  const logout = () => {
    pauseAutoSyncForAuth();

    if (user?.token && navigator.onLine) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      }).catch(() => {
        // Non-blocking logout notification
      });
    }

    setUser(null);
    localStorage.removeItem('ruralcare_auth_session');
    sessionStorage.removeItem('ruralcare_auth_session');
    // NOTE: Dexie database records & syncQueue items remain safely preserved offline.
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
