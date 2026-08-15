/**
 * Apka Bill Mobile - Shared Type Definitions
 */

export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  organization_id?: number | null;
  store_id?: number | null;
}

export interface OrganizationContext {
  id: number;
  name: string;
  slug?: string;
  status?: string;
  billingPlan?: string;
}

export interface StoreContext {
  id: number;
  name: string;
  code?: string;
}

export interface AuthSessionData {
  token: string;
  user: AuthUser;
  organization: OrganizationContext | null;
  store: StoreContext | null;
  organizationStatus?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  data?: any;
}

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  params?: Record<string, string | number | boolean>;
  skipAuth?: boolean;
}

export type ConnectionStatus =
  | 'idle'
  | 'checking'
  | 'connected'
  | 'failed';

export interface HealthCheckResult {
  ok: boolean;
  status: number;
  statusText: string;
  responseTimeMs: number;
  error?: string;
  url: string;
}

export interface HardwareStatus {
  thermalPrinter: 'disconnected' | 'connected' | 'not_supported';
  barcodeScanner: 'idle' | 'scanning' | 'not_supported';
  bluetooth: 'off' | 'on' | 'unauthorized';
  usb: 'disconnected' | 'connected';
}

export * from '../db/types';

