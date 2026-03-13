import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('operation_days').select('*').limit(1);
  console.log('Error:', error);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    // try to insert an empty object to get the schema error or something
    const res = await supabase.from('operation_days').insert([{}]).select();
    console.log('Insert Error:', res.error);
  }
}
check();
