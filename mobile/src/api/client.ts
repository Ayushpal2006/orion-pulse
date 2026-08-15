/**
 * Apka Bill Mobile - API Client Abstraction
 *
 * Responsibilities:
 * - Base URL configuration
 * - HTTP GET, POST, PUT, DELETE request methods
 * - Automated Authorization: Bearer <token> injection
 * - Configurable timeout handling via AbortController
 * - Error handling for 401, 403, 404, 422, 429, 500, network errors, timeouts
 * - 401 unauthorized interception hook
 *
 * ARCHITECTURAL RULE:
 * This client communicates strictly with the existing backend REST API.
 * The mobile application NEVER communicates directly with Neon PostgreSQL.
 */

import { CONFIG } from '../config/env';
import { ApiResponse, ApiRequestOptions, HealthCheckResult } from '../types';

export class ApiClientError extends Error {
  statusCode: number;
  data?: any;

  constructor(message: string, statusCode: number = 0, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private authToken: string | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor(baseUrl: string = CONFIG.apiBaseUrl, timeoutMs: number = CONFIG.timeoutMs) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = timeoutMs;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  public setOnUnauthorized(callback: (() => void) | null): void {
    this.onUnauthorizedCallback = callback;
  }

  /**
   * Internal request handler with timeout, auth token injection, and error normalization
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { timeoutMs = this.defaultTimeout, params, headers = {}, skipAuth = false, ...fetchOptions } = options;

    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Append query params if present
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        cleanEndpoint += (cleanEndpoint.includes('?') ? '&' : '?') + queryString;
      }
    }

    const fullUrl = `${this.baseUrl}${cleanEndpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client-Platform': CONFIG.isAndroid ? 'android' : 'ios',
      'X-Client-Version': CONFIG.appVersion,
    };

    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      Object.assign(requestHeaders, headers);
    }

    // Inject Bearer token if present and not explicitly skipped
    if (this.authToken && !skipAuth && !requestHeaders.Authorization) {
      requestHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timer);

      let responseData: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401) {
          if (this.onUnauthorizedCallback && !skipAuth) {
            this.onUnauthorizedCallback();
          }
        }

        const errorMessage =
          (typeof responseData === 'object' && (responseData?.error || responseData?.message)) ||
          `HTTP ${response.status}: ${response.statusText}`;

        throw new ApiClientError(errorMessage, response.status, responseData);
      }

      return {
        success: true,
        data: (responseData && typeof responseData === 'object' && 'data' in responseData)
          ? responseData.data
          : responseData,
        message: responseData?.message,
        statusCode: response.status,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new ApiClientError(`Request timeout after ${timeoutMs}ms`, 408);
      }
      if (err instanceof ApiClientError) {
        throw err;
      }
      throw new ApiClientError(err.message || 'Network unavailable or request failed', 0, err);
    }
  }

  /**
   * HTTP GET method
   */
  public async get<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * HTTP POST method
   */
  public async post<T = any>(
    endpoint: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  /**
   * HTTP PUT method
   */
  public async put<T = any>(
    endpoint: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  /**
   * HTTP DELETE method
   */
  public async delete<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Tests connectivity to the configured backend API
   */
  public async testConnection(healthEndpoint: string = '/health'): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const targetUrl = `${this.baseUrl}${healthEndpoint.startsWith('/') ? healthEndpoint : `/${healthEndpoint}`}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });

      clearTimeout(timer);
      const responseTimeMs = Date.now() - startTime;

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        responseTimeMs,
        url: targetUrl,
      };
    } catch (err: any) {
      const responseTimeMs = Date.now() - startTime;
      return {
        ok: false,
        status: 0,
        statusText: err.name === 'AbortError' ? 'Timeout' : 'Network Error',
        responseTimeMs,
        error: err.message || 'Unable to reach backend',
        url: targetUrl,
      };
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
