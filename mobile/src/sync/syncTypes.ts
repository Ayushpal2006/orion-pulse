/**
 * Apka Bill Mobile - Synchronization Types
 */

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export type SyncPhase =
  | 'idle'
  | 'authenticating'
  | 'store_context'
  | 'downloading_delta'
  | 'upserting_sqlite'
  | 'complete'
  | 'failed';

export interface SyncResult {
  success: boolean;
  isIncremental: boolean;
  storeUpdated: boolean;
  productsCount: number;
  customersCount: number;
  settingsCount: number;
  durationMs: number;
  lastSyncAt: string | null;
  error?: string;
}

export interface SyncState {
  status: SyncStatus;
  phase: SyncPhase;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  isSyncing: boolean;
  lastDurationMs?: number;
  lastResult?: SyncResult | null;
}

export interface SyncOptions {
  forceFull?: boolean;
  storeId?: number;
}
