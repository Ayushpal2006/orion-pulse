/**
 * Apka Bill Mobile - Environment & Configuration
 *
 * Central configuration module for API endpoints and runtime environment.
 * Prevents hardcoding of production/development URLs in components.
 */

import { Platform } from 'react-native';

declare const process: {
  env: {
    API_BASE_URL?: string;
    [key: string]: string | undefined;
  };
};

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  appName: string;
  appVersion: string;
  isAndroid: boolean;
  isDev: boolean;
  timeoutMs: number;
}

/**
 * Android Emulator uses 10.0.2.2 to access localhost on the host machine.
 * Physical Android devices on the same Wi-Fi typically use the host machine's LAN IP (e.g. 192.168.x.x).
 * iOS Simulator uses localhost.
 */
const getDefaultApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    // 10.0.2.2 routes to host localhost in Android Emulator
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

const getEnvBaseUrl = (): string | undefined => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) {
      return process.env.API_BASE_URL;
    }
  } catch {
    // Fallback if process is unavailable in specific bundle environments
  }
  return undefined;
};

export const CONFIG: AppConfig = {
  env: __DEV__ ? 'development' : 'production',
  apiBaseUrl: getEnvBaseUrl() || getDefaultApiBaseUrl(),
  appName: 'Apka Bill Mobile',
  appVersion: '1.0.0-phase1',
  isAndroid: Platform.OS === 'android',
  isDev: __DEV__,
  timeoutMs: 10000,
};

export default CONFIG;
