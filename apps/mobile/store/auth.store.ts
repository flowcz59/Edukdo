import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  schoolLevel: string;
  schoolName?: string | null;
  pointsTotal: number;
  pointsEarned: number;
  pointsSpent: number;
}

export interface ParentProfile {
  id: string;
  firstName: string;
  lastName: string;
}

export interface User {
  id: string;
  email: string;
  role: 'STUDENT' | 'PARENT' | 'ADMIN';
  studentProfile?: StudentProfile | null;
  parentProfile?: ParentProfile | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  initialize: () => Promise<void>;
  login: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: (newAccessToken: string, newRefreshToken?: string) => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN),
      ]);
      if (accessToken && refreshToken) {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (accessToken, refreshToken, user) => {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
    set({ accessToken, refreshToken, user, isAuthenticated: true });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN),
    ]);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  refreshTokens: async (newAccessToken, newRefreshToken) => {
    await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, newAccessToken);
    if (newRefreshToken) {
      await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, newRefreshToken);
    }
    set((state) => ({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken ?? state.refreshToken,
    }));
  },

  setUser: (user) => set({ user }),
}));
