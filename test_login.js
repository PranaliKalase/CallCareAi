import { supabase } from './src/services/supabase.js';

async function testLogin() {
  const email = 'doctor123@test.com'; // I don't know an existing account, I'll sign up then log in.
  const password = 'password123';

  console.log('Testing SignUp then Login...');
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: 'Test Doc', role: 'doctor' }
    }
  });

  if (signupError && signupError.message !== 'User already registered') {
    console.error('Signup failed:', signupError.message);
    return;
  }

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

testLogin();
