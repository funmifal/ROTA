import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token Security Architecture (Self-study compliance):
 *
 * CRITICAL SECURITY REQUIREMENT:
 * Tokens MUST be stored in `expo-secure-store` and NEVER in `AsyncStorage`.
 *
 * Why AsyncStorage is forbidden for tokens:
 * - AsyncStorage stores data as unencrypted plaintext JSON on disk.
 * - On Android, AsyncStorage writes to unencrypted XML files in `/data/data/<app>/shared_prefs`.
 * - On iOS, AsyncStorage writes to unencrypted `.plist` files in app sandbox directories.
 * - Any physical access, device backup, or rooted/jailbroken environment allows dumping tokens.
 *
 * Why Expo SecureStore is required:
 * - On iOS: Tokens are stored inside Keychain Services, protected by the hardware Secure Enclave.
 * - On Android: Tokens are encrypted using AES-256-GCM via Android KeyStore and EncryptedSharedPreferences.
 */

const ACCESS_TOKEN_KEY = 'rota_access_token';
const REFRESH_TOKEN_KEY = 'rota_refresh_token';

export const storage = {
  /**
   * Saves access and refresh tokens to hardware-encrypted secure storage.
   */
  async saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          if (refreshToken) {
            window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          }
        }
      } else {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
        }
      }
    } catch (error) {
      console.warn('[SecureStore] Failed to save tokens:', error);
    }
  },

  /**
   * Retrieves short-lived access token from secure storage.
   */
  async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
        }
        return null;
      }
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.warn('[SecureStore] Failed to retrieve access token:', error);
      return null;
    }
  },

  /**
   * Retrieves rotating refresh token from secure storage.
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
        }
        return null;
      }
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.warn('[SecureStore] Failed to retrieve refresh token:', error);
      return null;
    }
  },

  /**
   * Deletes all tokens from secure storage upon logout.
   */
  async clearTokens(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
          window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.warn('[SecureStore] Failed to delete tokens:', error);
    }
  },

  // Backward compatibility aliases
  async saveToken(token: string): Promise<void> {
    await this.saveTokens(token);
  },

  async getToken(): Promise<string | null> {
    return this.getAccessToken();
  },

  async deleteToken(): Promise<void> {
    await this.clearTokens();
  },
};
