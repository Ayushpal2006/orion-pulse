/**
 * Apka Bill Mobile - Authentication State & Context Layer
 *
 * Exposes:
 * - user, organization, store
 * - isAuthenticated, isLoading
 * - login(), logout(), refreshUser()
 *
 * Cold-Start Verification:
 * Validates session on launch via GET /api/auth/me against the existing backend.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/auth.service';
import { apiClient } from '../api/client';
import { AuthUser, OrganizationContext, StoreContext } from '../types';

export interface AuthContextType {
  user: AuthUser | null;
  organization: OrganizationContext | null;
  store: StoreContext | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<OrganizationContext | null>(null);
  const [store, setStore] = useState<StoreContext | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setOrganization(null);
      setStore(null);
      setIsAuthenticated(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authService.getCurrentUser();
      setUser(data.user);
      setOrganization(data.organization);
      setStore(data.currentStore);
      setIsAuthenticated(true);
    } catch {
      await logout();
    }
  }, [logout]);

  const login = async (email: string, pass: string) => {
    const session = await authService.login(email, pass);
    setUser(session.user);
    setOrganization(session.organization);
    setStore(session.store);
    setIsAuthenticated(true);
  };

  // Initialize session on startup
  useEffect(() => {
    let isMounted = true;

    // Attach 401 interceptor hook to API Client
    apiClient.setOnUnauthorized(() => {
      logout();
    });

    const initAuth = async () => {
      try {
        const stored = await authService.getStoredSession();
        if (stored && stored.token) {
          // If cached context exists, populate immediately for smooth UI
          if (stored.context) {
            if (stored.context.user) setUser(stored.context.user);
            if (stored.context.organization) setOrganization(stored.context.organization);
            if (stored.context.store) setStore(stored.context.store);
          }

          // Verify token against existing backend
          const meData = await authService.getCurrentUser();
          if (isMounted) {
            setUser(meData.user);
            setOrganization(meData.organization);
            setStore(meData.currentStore);
            setIsAuthenticated(true);
          }
        }
      } catch {
        if (isMounted) {
          await logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        store,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
