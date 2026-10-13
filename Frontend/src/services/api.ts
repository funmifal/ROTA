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
  token: string;
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getToken();

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
    if (res.token) {
      await storage.saveToken(res.token);
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
    if (res.token) {
      await storage.saveToken(res.token);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // safe to proceed even if offline
    } finally {
      await storage.deleteToken();
    }
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
};

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
