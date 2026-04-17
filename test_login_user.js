import { supabase } from './src/services/supabase.js';

async function testLoginUser() {
  const email = 'patient@care.com';
  const password = '123456789';

  console.log('Testing Login for:', email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Login failed:', error.message);
  } else {
    console.log('Login succeeded for user:', data.user.id);
  }
}

testLoginUser();
