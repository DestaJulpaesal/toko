import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const isPlaceholder = (key) => !key || key.startsWith('your_') || key.includes('placeholder') || key.includes('example');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = (!isPlaceholder(serviceKey) ? serviceKey : null) || (!isPlaceholder(anonKey) ? anonKey : null);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and a Supabase key are required');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;