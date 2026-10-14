import { storage } from './storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.7:5000';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
}

export interface AuthResponse {
  user: User;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface DashboardSummary {
  message: string;
  user: {
    id: string;
    email: string;
  };
  overview: {
    businessesCount: number;
    upcomingShiftsCount: number;
    pendingSwapsCount: number;
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = await storage.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new Error(`Cannot connect to Rota server at ${API_BASE_URL}. Ensure server is running and device is on the same network.`);
  }

  // Self-study requirement: automatic refresh token rotation when short-lived access token expires
  if (
    response.status === 401 &&
    !isRetry &&
    !endpoint.includes('/api/auth/login') &&
    !endpoint.includes('/api/auth/register') &&
    !endpoint.includes('/api/auth/refresh')
  ) {
    const refreshToken = await storage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          await storage.saveTokens(refreshData.accessToken, refreshData.refreshToken);
          return request<T>(endpoint, options, true); // Retry with rotated access token
        } else {
          // If refresh token was already used (stolen token detection) or expired, clear storage
          await storage.clearTokens();
        }
      } catch {
        await storage.clearTokens();
      }
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return request('/health');
  },

  async register(
    name: string,
    email: string,
    password: string,
    nameParts?: { firstName?: string; middleName?: string; lastName?: string }
  ): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(nameParts || {}),
      }),
    });
    const tokenToSave = res.accessToken || res.token;
    if (tokenToSave) {
      await storage.saveTokens(tokenToSave, res.refreshToken);
    }
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
    const tokenToSave = res.accessToken || res.token;
    if (tokenToSave) {
      await storage.saveTokens(tokenToSave, res.refreshToken);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      const refreshToken = await storage.getRefreshToken();
      await request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // safe to proceed
    } finally {
      await storage.clearTokens();
    }
  },

  async logoutAll(): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>('/api/auth/logout-all', {
        method: 'POST',
      });
    } finally {
      await storage.clearTokens();
    }
  },

  // Passwordless Magic Link
  async requestMagicLink(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  },

  async verifyMagicLink(token: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token: token.trim() }),
    });
    const tokenToSave = res.accessToken || res.token;
    if (tokenToSave) {
      await storage.saveTokens(tokenToSave, res.refreshToken);
    }
    return res;
  },

  // Password Reset (Single-use, expiring token)
  async forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: token.trim(), newPassword }),
    });
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    return request<DashboardSummary>('/api/dashboard/summary');
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string; email: string }> {
    return request<{ success: boolean; message: string; email: string }>('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      }),
    });
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
      }),
    });
  },

  // Business Management
  async getBusinesses(): Promise<{ businesses: Business[] }> {
    return request<{ businesses: Business[] }>('/api/businesses');
  },

  async createBusiness(data: { name: string; industry?: string; country?: string; timezone?: string }): Promise<{ message: string; business: Business }> {
    return request<{ message: string; business: Business }>('/api/businesses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getBusiness(businessId: string): Promise<{ business: Business }> {
    return request<{ business: Business }>(`/api/businesses/${businessId}`);
  },

  async updateBusiness(businessId: string, data: { name?: string; industry?: string; country?: string; timezone?: string }): Promise<{ message: string; business: Business }> {
    return request<{ message: string; business: Business }>(`/api/businesses/${businessId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Subscription & Flutterwave Billing
  async getSubscription(businessId: string): Promise<{
    subscription: any;
    seatUsage: { activeSeats: number; billableSeats: number; maxIncludedSeats: number; extraSeats: number };
  }> {
    return request<{
      subscription: any;
      seatUsage: { activeSeats: number; billableSeats: number; maxIncludedSeats: number; extraSeats: number };
    }>(`/api/businesses/${businessId}/billing`);
  },

  async initiateCheckout(
    businessId: string,
    data: { planId: 'STARTER' | 'TEAM' | 'BUSINESS'; seats: number; currency?: string }
  ): Promise<{
    message: string;
    checkout: {
      txRef: string;
      amountCents: number;
      currency: string;
      plan: string;
      seats: number;
      status: string;
      paymentUrl: string;
    };
  }> {
    return request<{
      message: string;
      checkout: {
        txRef: string;
        amountCents: number;
        currency: string;
        plan: string;
        seats: number;
        status: string;
        paymentUrl: string;
      };
    }>(`/api/businesses/${businessId}/billing/checkout`, {
      method: 'POST',
      body: JSON.stringify({ ...data, currency: data.currency || 'USD' }),
    });
  },

  // Team & Invitations
  async getMembers(businessId: string): Promise<{ members: TeamMember[] }> {
    return request<{ members: TeamMember[] }>(`/api/businesses/${businessId}/members`);
  },

  async inviteMember(businessId: string, data: { email: string; role: 'MANAGER' | 'STAFF' }): Promise<{ message: string; invitation: TeamInvitation; inviteUrl: string }> {
    return request<{ message: string; invitation: TeamInvitation; inviteUrl: string }>(`/api/businesses/${businessId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getInvitations(businessId: string): Promise<{ invitations: TeamInvitation[] }> {
    return request<{ invitations: TeamInvitation[] }>(`/api/businesses/${businessId}/invitations`);
  },

  async revokeInvitation(businessId: string, invitationId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/businesses/${businessId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },

  async getInvitationByToken(token: string): Promise<{ invitation: any }> {
    return request<{ invitation: any }>(`/api/invitations/${token}`);
  },

  async acceptInvitation(token: string): Promise<{ message: string; membership: any }> {
    return request<{ message: string; membership: any }>(`/api/invitations/${token}/accept`, {
      method: 'POST',
    });
  },

  async signUpWithInvitation(token: string, data: { name: string; password: string }): Promise<AuthResponse & { business: Business; membership: any }> {
    const res = await request<AuthResponse & { business: Business; membership: any }>(`/api/invitations/${token}/signup`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const tokenToSave = res.accessToken || res.token;
    if (tokenToSave) {
      await storage.saveTokens(tokenToSave, res.refreshToken);
    }
    return res;
  },

  async updateMember(businessId: string, memberId: string, data: { role?: 'MANAGER' | 'STAFF'; status?: string }): Promise<{ message: string; member: any }> {
    return request<{ message: string; member: any }>(`/api/businesses/${businessId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async removeMember(businessId: string, memberId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/businesses/${businessId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  // Activity Feed (Cursor Pagination)
  async getActivityFeed(
    businessId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<PaginatedActivityResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('limit', options.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<PaginatedActivityResponse>(`/api/businesses/${businessId}/activity${query}`);
  },

  // User Settings (Synced across devices)
  async getSettings(): Promise<{ settings: UserSettings }> {
    return request<{ settings: UserSettings }>('/api/users/settings');
  },

  async updateSettings(data: Partial<UserSettings>): Promise<{ message: string; settings: UserSettings }> {
    return request<{ message: string; settings: UserSettings }>('/api/users/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Shifts & Upcoming Shifts
  async getUpcomingShifts(businessId: string): Promise<{ shifts: ShiftItem[]; serverTime: string }> {
    return request<{ shifts: ShiftItem[]; serverTime: string }>(`/api/businesses/${businessId}/shifts/upcoming`);
  },

  async seedUpcomingShifts(businessId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/businesses/${businessId}/shifts/seed`, {
      method: 'POST',
    });
  },

  // Shift Swaps (Kemi's Scenario)
  async requestSwap(
    businessId: string,
    data: { shiftAssignmentId: string; reason?: string; targetMembershipId?: string }
  ): Promise<{ message: string; swapRequest: SwapRequestItem }> {
    return request<{ message: string; swapRequest: SwapRequestItem }>(`/api/businesses/${businessId}/swaps`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Push Notifications & Device Registration (Requirement 6)
  async registerDevice(data: {
    deviceId: string;
    pushToken: string;
    platform?: string;
    deviceName?: string;
  }): Promise<{ message: string; device: any }> {
    return request('/api/notifications/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async unregisterDevice(deviceId: string): Promise<{ message: string }> {
    return request(`/api/notifications/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },

  async getNotifications(): Promise<{ notifications: any[]; unreadCount: number }> {
    return request('/api/notifications');
  },

  async markNotificationRead(notificationId: string): Promise<{ message: string }> {
    return request(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsRead(): Promise<{ message: string }> {
    return request('/api/notifications/read-all', {
      method: 'PATCH',
    });
  },
};

export interface UserSettings {
  id?: string;
  notificationsEnabled: boolean;
  notifyShiftChanges?: boolean;
  notifySwaps?: boolean;
  notifyBilling?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  emailAlerts: boolean;
  shiftReminders: boolean;
  timeFormat24h: boolean;
  autoAcceptSwaps: boolean;
  theme: string;
  language?: string;
  updatedAt?: string;
  clientUpdatedAt?: string;
}

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

export interface SwapRequestItem {
  id: string;
  businessId: string;
  shiftAssignmentId: string;
  requesterMembershipId: string;
  targetMembershipId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  reason: string | null;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  industry?: string;
  country?: string;
  timezone: string;
  memberCount?: number;
  currentUserRole?: 'OWNER' | 'MANAGER' | 'STAFF';
  currentMembershipStatus?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
  departments?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
}

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
  joinedAt: string;
  emailVerified: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: 'MANAGER' | 'STAFF';
  expiresAt: string;
  createdAt: string;
  invitedBy?: string;
  inviteUrl: string;
}

export interface ActivityFeedItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface PaginatedActivityResponse {
  items: ActivityFeedItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}
