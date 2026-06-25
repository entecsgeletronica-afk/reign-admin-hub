import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://xtfjlhcptkholgppetfq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0ZmpsaGNwdGtob2xncHBldGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMzkwNDYsImV4cCI6MjA5NzkxNTA0Nn0.yuDi9K6bPll50eaSk0_7FC6OWrL5qLksW0hzRamde7w";

// NOTE: `Database` types are currently empty because the schema has not yet
// been restored on the connected Supabase project. Using `any` here unblocks
// TypeScript; once the backup SQL is executed and types regenerate, switch
// back to `createClient<Database>(...)`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export an untyped version for raw access if needed (like dynamic table names)
export const supabaseAny = supabase as any;

// Helper to check configuration status
export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_PUBLISHABLE_KEY;
