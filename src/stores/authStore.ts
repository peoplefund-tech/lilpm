import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isEmailVerified: boolean;
}

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  resendVerificationEmail: () => Promise<void>;
}

const mapSupabaseUser = (supabaseUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; created_at?: string }): User => ({
  id: supabaseUser.id,
  email: supabaseUser.email || '',
  name: (supabaseUser.user_metadata?.name as string) || supabaseUser.email?.split('@')[0] || '',
  avatarUrl: supabaseUser.user_metadata?.avatar_url as string | undefined,
  role: 'member',
  createdAt: supabaseUser.created_at || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isEmailVerified: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          set({ isLoading: false });
          throw new Error(error.message);
        }

        if (data.user) {
          const emailVerified = !!data.user.email_confirmed_at;
          set({
            user: mapSupabaseUser(data.user),
            isAuthenticated: true,
            isLoading: false,
            isEmailVerified: emailVerified,
          });
        }
      },

      signup: async (email: string, password: string, name: string) => {
        set({ isLoading: true });

        // Use environment variable for production URL, fallback to current origin
        // Email verification link redirects to team creation page
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const redirectUrl = `${siteUrl}/onboarding/create-team`;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          set({ isLoading: false });
          throw new Error(error.message);
        }

        if (data.user) {
          const user = mapSupabaseUser(data.user);
          user.name = name;
          // New signups are NOT email verified yet
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            isEmailVerified: false,
          });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isEmailVerified: false,
        });
      },

      loadUser: async () => {
        // Don't set loading if we're already loading to avoid flicker
        const currentState = get();
        if (!currentState.isLoading) {
          set({ isLoading: true });
        }

        try {
          // Set up auth state listener (only once)
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
              const emailVerified = !!session.user.email_confirmed_at;
              set({
                user: mapSupabaseUser(session.user),
                isAuthenticated: true,
                isLoading: false,
                isEmailVerified: emailVerified,
              });
            } else {
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                isEmailVerified: false,
              });
            }
          });

          // Get initial session
          const { data: { session }, error } = await supabase.auth.getSession();

          // Handle auth errors (like 403) by clearing corrupted session
          if (error) {
            console.warn('Auth session error, clearing local auth state:', error.message);
            // Clear any corrupted auth state from localStorage
            localStorage.removeItem('sb-lbzjnhlribtfwnoydpdv-auth-token');
            localStorage.removeItem('auth-storage');
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              isEmailVerified: false,
            });
            return;
          }

          if (session?.user) {
            const emailVerified = !!session.user.email_confirmed_at;
            set({
              user: mapSupabaseUser(session.user),
              isAuthenticated: true,
              isLoading: false,
              isEmailVerified: emailVerified,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              isEmailVerified: false,
            });
          }
        } catch (error: any) {
          console.error('Failed to load user:', error);
          // On any error, clear auth state to prevent loops
          localStorage.removeItem('sb-lbzjnhlribtfwnoydpdv-auth-token');
          localStorage.removeItem('auth-storage');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isEmailVerified: false,
          });
        }
      },

      resendVerificationEmail: async () => {
        const currentUser = get().user;
        if (!currentUser?.email) {
          throw new Error('No user email found');
        }

        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const redirectUrl = `${siteUrl}/onboarding/create-team`;

        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: currentUser.email,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          throw new Error(error.message);
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
