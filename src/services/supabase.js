import { createClient } from '@supabase/supabase-js';

// Use same credentials as the old React Native app for consistency
const supabaseUrl = 'https://uragmspajuadjbbyzmaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyYWdtc3BhanVhZGpiYnl6bWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDY5NzEsImV4cCI6MjA5MTI4Mjk3MX0.SC2qp7sKrI2nHKTc5fVVisyunc_1X7jRu20WY69hFws';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'careplus-auth',
  }
});
