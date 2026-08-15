/**
 * Apka Bill Mobile - Secure Token & Credentials Storage
 *
 * Responsibilities:
 * - Uses native secure hardware storage (Android Keystore / iOS Keychain via react-native-keychain)
 * - Prohibits AsyncStorage / localStorage / plain text storage for JWT tokens
 * - Provides graceful fallback for headless / test environments
 */

const KEYCHAIN_SERVICE = 'com.apkabill.mobile.auth';

// In-memory fallback for headless, test runners, or environments without native Keystore
let memoryTokenFallback: string | null = null;
let memoryUserJsonFallback: string | null = null;

// Safe dynamic accessor for react-native-keychain
const getKeychain = () => {
  try {
    return require('react-native-keychain');
  } catch {
    return null;
  }
};

export const StorageService = {
  /**
   * Securely saves the authentication token and serialized session payload to native Keystore / Keychain
   */
  async saveAuthToken(token: string, sessionContextJson?: string): Promise<boolean> {
    const Keychain = getKeychain();
    if (!Keychain) {
      memoryTokenFallback = token;
      memoryUserJsonFallback = sessionContextJson || null;
      return true;
    }

    try {
      const username = sessionContextJson || 'session';
      await Keychain.setGenericPassword(username, token, {
        service: KEYCHAIN_SERVICE,
        accessible: Keychain.ACCESSIBLE ? Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY : undefined,
        securityLevel: Keychain.SECURITY_LEVEL ? Keychain.SECURITY_LEVEL.SECURE_HARDWARE : undefined,
      });
      return true;
    } catch {
      try {
        // Fallback with standard accessibility if hardware security level isn't available on emulator
        const username = sessionContextJson || 'session';
        await Keychain.setGenericPassword(username, token, {
          service: KEYCHAIN_SERVICE,
        });
        return true;
      } catch {
        // In-memory fallback
        memoryTokenFallback = token;
        memoryUserJsonFallback = sessionContextJson || null;
        return true;
      }
    }
  },

  /**
   * Retrieves the secure authentication token and session context from Keystore / Keychain
   */
  async getAuthToken(): Promise<{ token: string; contextJson: string | null } | null> {
    const Keychain = getKeychain();
    if (!Keychain) {
      if (memoryTokenFallback) {
        return {
          token: memoryTokenFallback,
          contextJson: memoryUserJsonFallback,
        };
      }
      return null;
    }

    try {
      const credentials = await Keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
      });

      if (credentials) {
        return {
          token: credentials.password,
          contextJson: credentials.username !== 'session' ? credentials.username : null,
        };
      }
      return null;
    } catch {
      if (memoryTokenFallback) {
        return {
          token: memoryTokenFallback,
          contextJson: memoryUserJsonFallback,
        };
      }
      return null;
    }
  },

  /**
   * Clears the authentication token and session context on logout
   */
  async clearAuthToken(): Promise<boolean> {
    const Keychain = getKeychain();
    memoryTokenFallback = null;
    memoryUserJsonFallback = null;

    if (!Keychain) {
      return true;
    }

    try {
      await Keychain.resetGenericPassword({
        service: KEYCHAIN_SERVICE,
      });
      return true;
    } catch {
      return true;
    }
  },
};

export default StorageService;
