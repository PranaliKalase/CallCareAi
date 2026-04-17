import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uragmspajuadjbbyzmaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyYWdtc3BhanVhZGpiYnl6bWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDY5NzEsImV4cCI6MjA5MTI4Mjk3MX0.SC2qp7sKrI2nHKTc5fVVisyunc_1X7jRu20WY69hFws';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'doctors' }); // won't work if rpc doesn't exist
  // To get columns, we can just do a select from information_schema if we had connection string. 
  // Let's just try to select hospital_id:
  const { data: testData, error: err } = await supabase.from('doctors').select('id, hospital_id');
  console.log("hospital_id select test:", testData, err);
}

run();
