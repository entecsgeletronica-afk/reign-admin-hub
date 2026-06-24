import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://szehbsirshphrdiuyfty.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6ZWhic2lyc2hwaHJkaXV5ZnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDE0MzYsImV4cCI6MjA5MzkxNzQzNn0.OGi6uGBule8RTlm8XI4q7YMn5YNKGUhIpGxKg42pknU";

// Export the typed client
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
