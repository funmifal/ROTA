import { storage } from './storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.7:5000';

export interface User {
  id: string;
  name: string;
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

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (res.token) {
      await storage.saveToken(res.token);
    }
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
};
