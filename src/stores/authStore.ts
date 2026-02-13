import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { apiClient } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isEmailVerified: boolean;
}

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, returnUrl?: string, isInvite?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  resendVerificationEmail: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      // Start as false - the persist middleware will hydrate user/isAuthenticated
      // from localStorage synchronously. loadUser() verifies in the background.
      isLoading: false,
      isEmailVerified: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        const result = await apiClient.post<{
          user: { id: string; email: string; emailVerified: boolean; name: string; avatarUrl?: string };
          accessToken: string;
          refreshToken: string;
        }>('/auth/login', { email, password });

        if (!result.success) {
          set({ isLoading: false });
          throw new Error(result.error || 'Login failed');
        }

        const { user: userData, accessToken, refreshToken } = result.data;
        apiClient.setTokens(accessToken, refreshToken);

        set({
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name || userData.email.split('@')[0],
            avatarUrl: userData.avatarUrl,
            role: 'member',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          isAuthenticated: true,
          isLoading: false,
          isEmailVerified: userData.emailVerified,
        });
      },

      signup: async (email: string, password: string, name: string, _returnUrl?: string, isInvite?: boolean) => {
        set({ isLoading: true });

        const result = await apiClient.post<{
          user: { id: string; email: string };
          accessToken: string;
          refreshToken: string;
        }>('/auth/signup', { email, password, name });

        if (!result.success) {
          set({ isLoading: false });
          throw new Error(result.error || 'Signup failed');
        }

        const { user: userData, accessToken, refreshToken } = result.data;
        apiClient.setTokens(accessToken, refreshToken);

        set({
          user: {
            id: userData.id,
            email: userData.email,
            name,
            role: 'member',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          isAuthenticated: true,
          isLoading: false,
          // Invite signups are considered email-verified (they clicked the invite email)
          isEmailVerified: isInvite ? true : false,
        });
      },

      logout: async () => {
        try {
          await apiClient.post('/auth/logout', {
            refreshToken: localStorage.getItem('auth_refresh_token'),
          });
        } catch {
          // ignore logout API errors
        }

        apiClient.setTokens(null, null);

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isEmailVerified: false,
        });
      },

      loadUser: async () => {
        // Only show loading spinner if we don't have a cached user session.
        const currentState = get();
        if (!currentState.isAuthenticated) {
          set({ isLoading: true });
        }

        // If no token stored, nothing to load
        const token = apiClient.getAccessToken();
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false, isEmailVerified: false });
          return;
        }

        try {
          const result = await apiClient.get<{
            id: string;
            email: string;
            emailVerified: boolean;
            name: string;
            avatarUrl?: string;
          }>('/auth/me');

          if (!result.success) {
            // Token is invalid and refresh also failed — clear state
            apiClient.setTokens(null, null);
            set({ user: null, isAuthenticated: false, isLoading: false, isEmailVerified: false });
            return;
          }

          const userData = result.data;
          set({
            user: {
              id: userData.id,
              email: userData.email,
              name: userData.name || userData.email.split('@')[0],
              avatarUrl: userData.avatarUrl,
              role: 'member',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            isAuthenticated: true,
            isLoading: false,
            isEmailVerified: userData.emailVerified,
          });
        } catch (error: any) {
          console.error('Failed to load user:', error);
          apiClient.setTokens(null, null);
          set({ user: null, isAuthenticated: false, isLoading: false, isEmailVerified: false });
        }
      },

      resendVerificationEmail: async () => {
        const currentUser = get().user;
        if (!currentUser?.email) {
          throw new Error('No user email found');
        }

        const result = await apiClient.post('/auth/resend-verification', {
          email: currentUser.email,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to resend verification email');
        }
      },

      updateUser: (data: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...data } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Register auth failure handler — auto-logout when refresh token expires
apiClient.onAuthError(() => {
  useAuthStore.getState().logout();
});
