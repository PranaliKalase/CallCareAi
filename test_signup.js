import { supabase } from './src/services/supabase.js';

async function testSignup() {
  const email = `test_${Date.now()}@test.com`;
  console.log('Trying to sign up:', email);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: {
      data: { full_name: 'Test Hospital', role: 'hospital' }
    }
  });

  if (error) {
    console.error('Signup failed:', error.message);
  } else {
    console.log('Signup succeeded!', data.user.id);
  }
}

testSignup();
