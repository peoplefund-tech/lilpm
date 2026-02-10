import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lbzjnhlribtfwnoydpdv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiempuaGxyaWJ0Zndub3lkcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzg2MDksImV4cCI6MjA4NTY1NDYwOX0.I_d7hzeHdi82osxF0Y90SQq41ilguENbK5bMkNSvbGU';

/**
 * Singleton Supabase client instance
 * Optimized for frontend use with:
 * - Auto token refresh
 * - Session persistence in localStorage
 * - URL session detection for OAuth/magic link flows
 * - Realtime multiplexing enabled
 * - Optimized global fetch headers
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use localStorage for session storage (default, explicit for clarity)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      // Reduce heartbeat interval for faster disconnect detection
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'lilpm-web',
    },
  },
  db: {
    // Use PostgREST schema (default, explicit for clarity)
    schema: 'public',
  },
});

/** Helper to get current authenticated user */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/** Helper to get current session */
export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

/**
 * Helper to check if user is authenticated
 * Uses getSession() for speed (cached), not getUser() (API call)
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getCurrentSession();
  return !!session;
};
