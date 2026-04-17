import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pdqpgxlyzjylqrrnlkpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXBneGx5emp5bHFycm5sa3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDgyOTMsImV4cCI6MjA5MTk4NDI5M30.rSz-vyL2WRRGM-hTD0oaE3v-DiYpBX0QwS3UD1wV5F8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'doctors' }); // won't work if rpc doesn't exist
  // To get columns, we can just do a select from information_schema if we had connection string. 
  // Let's just try to select hospital_id:
  const { data: testData, error: err } = await supabase.from('doctors').select('id, hospital_id');
  console.log("hospital_id select test:", testData, err);
}

run();
