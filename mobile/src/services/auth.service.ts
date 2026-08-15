/**
 * Apka Bill Mobile - Authentication Service
 *
 * Responsibilities:
 * - login(email, password)
 * - logout()
 * - getCurrentUser()
 * - getStoredSession()
 *
 * Ensures all auth operations communicate with existing backend REST endpoints.
 * Never connects directly to Neon PostgreSQL.
 */

import { apiClient, ApiClientError } from '../api/client';
import { StorageService } from './storage.service';
import { AuthSessionData, AuthUser, OrganizationContext, StoreContext } from '../types';

export class AuthService {
  /**
   * Performs login against the existing backend REST API (`POST /api/auth/login`)
   */
  async login(email: string, password: string): Promise<AuthSessionData> {
    const cleanEmail = email.trim().toLowerCase();

    const response = await apiClient.post<AuthSessionData>(
      '/api/auth/login',
      { email: cleanEmail, password },
      { skipAuth: true }
    );

    if (!response.data || !response.data.token) {
      throw new ApiClientError('Invalid response from authentication server', 500);
    }

    const sessionData: AuthSessionData = response.data;

    // Set token on active API client
    apiClient.setAuthToken(sessionData.token);

    // Securely persist token and serialized context
    await StorageService.saveAuthToken(
      sessionData.token,
      JSON.stringify({
        user: sessionData.user,
        organization: sessionData.organization,
        store: sessionData.store,
        organizationStatus: sessionData.organizationStatus,
      })
    );

    return sessionData;
  }

  /**
   * Fetches the current authenticated user and tenant context (`GET /api/auth/me`)
   */
  async getCurrentUser(): Promise<{
    user: AuthUser;
    organization: OrganizationContext | null;
    currentStore: StoreContext | null;
    organizationStatus?: string;
  }> {
    const response = await apiClient.get<{
      user: AuthUser;
      organization: OrganizationContext | null;
      currentStore: StoreContext | null;
      organizationStatus?: string;
    }>('/api/auth/me');

    return response.data;
  }

  /**
   * Restores stored session on cold start from secure hardware storage
   */
  async getStoredSession(): Promise<{ token: string; context: Partial<AuthSessionData> | null } | null> {
    const stored = await StorageService.getAuthToken();
    if (!stored || !stored.token) {
      return null;
    }

    apiClient.setAuthToken(stored.token);

    let context: Partial<AuthSessionData> | null = null;
    if (stored.contextJson) {
      try {
        context = JSON.parse(stored.contextJson);
      } catch {
        context = null;
      }
    }

    return {
      token: stored.token,
      context,
    };
  }

  /**
   * Logs out the user, notifies the backend (`POST /api/auth/logout`), and wipes credentials
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch {
      // Continue clearing local state even if backend network call fails
    } finally {
      apiClient.setAuthToken(null);
      await StorageService.clearAuthToken();
    }
  }
}

export const authService = new AuthService();
export default authService;
