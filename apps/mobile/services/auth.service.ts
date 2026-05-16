import apiClient from './api.service';
import { User } from '../store/auth.store';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: 'STUDENT' | 'PARENT';
  firstName: string;
  lastName: string;
  birthDate?: string;
  schoolLevel?: string;
  schoolName?: string;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/api/auth/register', payload);
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/api/auth/logout', { refreshToken });
  },
};
