import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ShiftItem {
  id: string;
  businessId: string;
  title: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  notes: string | null;
  department: string | null;
  location: string | null;
  isAssignedToMe: boolean;
  myAssignmentId: string | null;
  assignedStaffCount: number;
  swapStatus: string | null;
  swapRequestId: string | null;
  canRequestSwap: boolean;
}

export interface CachedShiftsPayload {
  shifts: ShiftItem[];
  lastUpdated: string; // ISO 8601 string
}

const STORAGE_PREFIX = '@rota_offline_shifts_';

/**
 * Service for local persistence of upcoming shifts.
 * Meets Requirement 2: Persisted state that survives closing the app for offline use.
 */
export const offlineShiftsStorage = {
  /**
   * Persists upcoming shifts locally with a record of the sync timestamp.
   */
  async saveOfflineShifts(
    businessId: string,
    shifts: ShiftItem[],
    timestamp: string = new Date().toISOString()
  ): Promise<void> {
    try {
      const payload: CachedShiftsPayload = {
        shifts,
        lastUpdated: timestamp,
      };
      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}${businessId}`,
        JSON.stringify(payload)
      );
    } catch (err) {
      console.warn('[offlineShiftsStorage] Failed to save offline shifts:', err);
    }
  },

  /**
   * Reads persisted shifts and last updated timestamp from local storage.
   */
  async getOfflineShifts(businessId: string): Promise<CachedShiftsPayload | null> {
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${businessId}`);
      if (!raw) return null;
      return JSON.parse(raw) as CachedShiftsPayload;
    } catch (err) {
      console.warn('[offlineShiftsStorage] Failed to read offline shifts:', err);
      return null;
    }
  },

  /**
   * Removes cached shifts for a business.
   */
  async clearOfflineShifts(businessId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${businessId}`);
    } catch (err) {
      console.warn('[offlineShiftsStorage] Failed to clear offline shifts:', err);
    }
  },
};
