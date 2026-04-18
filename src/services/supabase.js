import { createClient } from '@supabase/supabase-js';

// Use same credentials as the old React Native app for consistency
const supabaseUrl = 'https://pdqpgxlyzjylqrrnlkpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXBneGx5emp5bHFycm5sa3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDgyOTMsImV4cCI6MjA5MTk4NDI5M30.rSz-vyL2WRRGM-hTD0oaE3v-DiYpBX0QwS3UD1wV5F8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
