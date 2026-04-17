import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pdqpgxlyzjylqrrnlkpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXBneGx5emp5bHFycm5sa3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDgyOTMsImV4cCI6MjA5MTk4NDI5M30.rSz-vyL2WRRGM-hTD0oaE3v-DiYpBX0QwS3UD1wV5F8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: doctors, error } = await supabase.from('doctors').select('*');
  console.log("Doctors: ", JSON.stringify(doctors, null, 2));
  console.log("Error: ", error);
}

run();
