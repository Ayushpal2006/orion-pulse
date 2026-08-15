/**
 * Apka Bill Mobile - Environment & Configuration
 *
 * Central configuration module for API endpoints and runtime environment.
 * Prevents hardcoding of production/development URLs in components.
 */

declare const process: {
  env: {
    API_BASE_URL?: string;
    NODE_ENV?: string;
    [key: string]: string | undefined;
  };
};

declare const __DEV__: boolean | undefined;

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  appName: string;
  appVersion: string;
  isAndroid: boolean;
  isDev: boolean;
  timeoutMs: number;
}

const isDevelopment = (): boolean => {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
};

const getPlatformOS = (): string => {
  try {
    // Dynamic access for React Native Platform without crashing in Node.js
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    if (RN && RN.Platform && RN.Platform.OS) {
      return RN.Platform.OS;
    }
  } catch {
    // Fallback if running outside React Native runtime
  }
  return 'android';
};

/**
 * Android Emulator uses 10.0.2.2 to access localhost on the host machine.
 * Physical Android devices on the same Wi-Fi typically use the host machine's LAN IP (e.g. 192.168.x.x).
 * iOS Simulator uses localhost.
 */
const getDefaultApiBaseUrl = (): string => {
  const os = getPlatformOS();
  if (os === 'android') {
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

const devMode = isDevelopment();
const currentOS = getPlatformOS();

export const CONFIG: AppConfig = {
  env: devMode ? 'development' : 'production',
  apiBaseUrl: getEnvBaseUrl() || getDefaultApiBaseUrl(),
  appName: 'Apka Bill Mobile',
  appVersion: '1.0.0-phase2',
  isAndroid: currentOS === 'android',
  isDev: devMode,
  timeoutMs: 10000,
};

export default CONFIG;
