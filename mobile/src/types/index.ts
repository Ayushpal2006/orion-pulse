/**
 * Apka Bill Mobile - Shared Type Definitions
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  statusCode?: number;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  error?: any;
}

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  params?: Record<string, string | number | boolean>;
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
