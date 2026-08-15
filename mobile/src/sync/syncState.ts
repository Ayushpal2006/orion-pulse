/**
 * Apka Bill Mobile - Sync State Manager
 *
 * Manages reactive in-memory synchronization state with persistent SQLite backing.
 */

import { SyncState, SyncResult, SyncPhase, SyncStatus } from './syncTypes';
import { SettingsRepository } from '../db/repositories/settings.repository';

const SYNC_KEY_LAST_AT = 'sync_last_successful_at';
const SYNC_KEY_LAST_ERROR = 'sync_last_error';

type StateListener = (state: SyncState) => void;

class SyncStateManager {
  private state: SyncState = {
    status: 'idle',
    phase: 'idle',
    lastSyncAt: null,
    lastSyncError: null,
    isSyncing: false,
    lastDurationMs: 0,
    lastResult: null,
  };

  private listeners = new Set<StateListener>();
  private initialized = false;

  /**
   * Loads persisted sync markers from SQLite
   */
  async init(): Promise<SyncState> {
    if (this.initialized) return this.state;
    try {
      const [lastAt, lastErr] = await Promise.all([
        SettingsRepository.getSyncState(SYNC_KEY_LAST_AT),
        SettingsRepository.getSyncState(SYNC_KEY_LAST_ERROR),
      ]);

      this.state = {
        ...this.state,
        lastSyncAt: lastAt,
        lastSyncError: lastErr,
      };
      this.initialized = true;
    } catch (err: any) {
      console.warn('[SyncState] Could not load persisted sync state from DB:', err.message);
    }
    return this.state;
  }

  getState(): SyncState {
    return { ...this.state };
  }

  setPhase(phase: SyncPhase, status: SyncStatus = 'syncing') {
    this.state = {
      ...this.state,
      status,
      phase,
      isSyncing: status === 'syncing',
    };
    this.notify();
  }

  async markSuccess(result: SyncResult) {
    this.state = {
      ...this.state,
      status: 'success',
      phase: 'complete',
      isSyncing: false,
      lastSyncAt: result.lastSyncAt,
      lastSyncError: null,
      lastDurationMs: result.durationMs,
      lastResult: result,
    };

    if (result.lastSyncAt) {
      try {
        await SettingsRepository.setSyncState(SYNC_KEY_LAST_AT, result.lastSyncAt);
        await SettingsRepository.setSyncState(SYNC_KEY_LAST_ERROR, '');
      } catch (err: any) {
        console.warn('[SyncState] Could not persist sync success state:', err.message);
      }
    }

    this.notify();
  }

  async markError(error: string, durationMs: number) {
    this.state = {
      ...this.state,
      status: 'error',
      phase: 'failed',
      isSyncing: false,
      lastSyncError: error,
      lastDurationMs: durationMs,
    };

    try {
      await SettingsRepository.setSyncState(SYNC_KEY_LAST_ERROR, error);
    } catch (err: any) {
      console.warn('[SyncState] Could not persist sync error state:', err.message);
    }

    this.notify();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[SyncState] Error in sync state listener:', err);
      }
    }
  }
}

export const syncStateManager = new SyncStateManager();
export default syncStateManager;
