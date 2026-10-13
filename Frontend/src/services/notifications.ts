import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { api } from './api';
import { storage } from './storage';

const DEVICE_ID_KEY = 'rota_device_id';

export const notifications = {
  /**
   * Retrieves or initializes a unique, hardware-persisted device ID.
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await storage.getAccessToken(); // Check secure storage
      const storedId = await storage.getItem(DEVICE_ID_KEY);
      if (storedId) {
        return storedId;
      }
      const newId = `dev_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await storage.setItem(DEVICE_ID_KEY, newId);
      return newId;
    } catch {
      return `dev_${Platform.OS}_${Date.now()}`;
    }
  },

  /**
   * Registers this device's push token with the server after login.
   * Requirement 6: Linked to the user and the device. One user can have several devices.
   */
  async registerPushToken(pushToken: string): Promise<void> {
    try {
      const deviceId = await this.getOrCreateDeviceId();
      await api.registerDevice({
        deviceId,
        pushToken,
        platform: Platform.OS,
        deviceName: `${Platform.OS.toUpperCase()} Device`,
      });
      console.log(`[NotificationService] Registered device token for device ${deviceId}`);
    } catch (err: any) {
      console.warn('[NotificationService] Failed to register push token:', err.message);
    }
  },

  /**
   * Unregisters device on logout.
   */
  async unregisterCurrentDevice(): Promise<void> {
    try {
      const deviceId = await this.getOrCreateDeviceId();
      await api.unregisterDevice(deviceId);
    } catch (err: any) {
      console.warn('[NotificationService] Failed to unregister device:', err.message);
    }
  },

  /**
   * Parses deep links from push notifications:
   * "Tapping a notification opens the exact screen it refers to (deep linking)"
   */
  handleDeepLink(url: string, onNavigate?: (screen: string, params?: Record<string, any>) => void): void {
    if (!url) return;

    try {
      const parsed = Linking.parse(url);
      const path = parsed.path || '';

      if (path.startsWith('shifts/')) {
        const shiftId = path.replace('shifts/', '');
        onNavigate?.('ShiftDetails', { shiftId });
      } else if (path.startsWith('swaps/')) {
        const swapId = path.replace('swaps/', '');
        onNavigate?.('SwapDetails', { swapId });
      } else if (path === 'billing' || path.startsWith('billing')) {
        onNavigate?.('Billing');
      } else if (path === 'activity' || path.startsWith('activity')) {
        onNavigate?.('ActivityFeed');
      }
    } catch (e) {
      console.warn('[DeepLink] Failed to parse URL:', url, e);
    }
  },

  /**
   * Sets up deep link listeners.
   */
  setupDeepLinkListener(onNavigate?: (screen: string, params?: Record<string, any>) => void) {
    // 1. Handle app launched from deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleDeepLink(url, onNavigate);
      }
    });

    // 2. Handle app opened while running
    const subscription = Linking.addEventListener('url', (event) => {
      this.handleDeepLink(event.url, onNavigate);
    });

    return () => {
      subscription.remove();
    };
  },
};
