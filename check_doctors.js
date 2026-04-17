import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uragmspajuadjbbyzmaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyYWdtc3BhanVhZGpiYnl6bWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDY5NzEsImV4cCI6MjA5MTI4Mjk3MX0.SC2qp7sKrI2nHKTc5fVVisyunc_1X7jRu20WY69hFws';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: doctors, error } = await supabase.from('doctors').select('*');
  console.log("Doctors: ", JSON.stringify(doctors, null, 2));
  console.log("Error: ", error);
}

run();
