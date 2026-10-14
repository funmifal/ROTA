import { create } from 'zustand';
import { Business } from '../services/api';

/**
 * Client UI State managed via Zustand.
 *
 * Architectural Justification:
 * Zustand is selected as our client state management tool because:
 * 1. Minimal footprint & Zero Boilerplate: Does not require Redux-style action dispatchers,
 *    reducers, or nested Context Providers that degrade React Native render performance.
 * 2. Fine-grained Selective Re-renders: Components subscribe only to the specific state slices
 *    they consume (e.g. `useAppStore(s => s.activeTab)`), eliminating re-render cascades.
 * 3. Clear Boundary: Purely handles volatile, client-only UI state (tab selection, active business,
 *    modal visibility, simulated offline testing mode) without contaminating server query cache.
 */

export type AppTab = 'dashboard' | 'shifts' | 'team' | 'billing' | 'activity' | 'settings';

interface AppState {
  // Navigation & Tab state
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Selected active business in the app
  activeBusiness: Business | null;
  setActiveBusiness: (business: Business | null) => void;

  // UI Modals & Filters
  isCreateBusinessModalOpen: boolean;
  setCreateBusinessModalOpen: (open: boolean) => void;

  isRequestSwapModalOpen: boolean;
  setRequestSwapModalOpen: (open: boolean) => void;

  // Testing & Offline Simulation toggle
  // Allows testing offline shift viewing and rollback behavior on demand
  isSimulatedOffline: boolean;
  setSimulatedOffline: (offline: boolean) => void;

  shouldSimulateSwapFailure: boolean;
  setShouldSimulateSwapFailure: (simulate: boolean) => void;

  shouldSimulateSettingsFailure: boolean;
  setShouldSimulateSettingsFailure: (simulate: boolean) => void;

  // Transient Toast / Banner Feedback
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeBusiness: null,
  setActiveBusiness: (business) => set({ activeBusiness: business }),

  isCreateBusinessModalOpen: false,
  setCreateBusinessModalOpen: (open) => set({ isCreateBusinessModalOpen: open }),

  isRequestSwapModalOpen: false,
  setRequestSwapModalOpen: (open) => set({ isRequestSwapModalOpen: open }),

  isSimulatedOffline: false,
  setSimulatedOffline: (offline) => set({ isSimulatedOffline: offline }),

  shouldSimulateSwapFailure: false,
  setShouldSimulateSwapFailure: (simulate) => set({ shouldSimulateSwapFailure: simulate }),

  shouldSimulateSettingsFailure: false,
  setShouldSimulateSettingsFailure: (simulate) => set({ shouldSimulateSettingsFailure: simulate }),

  toastMessage: null,
  showToast: (text, type = 'info') => set({ toastMessage: { text, type } }),
  clearToast: () => set({ toastMessage: null }),
}));
