const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
env.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...vals] = line.split('=');
    process.env[key.trim()] = vals.join('=').trim().replace(/['"]/g, '');
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('proposals').select('id').limit(1);
  if (error && error.code === '42P01') {
      console.log("Table proposals does not exist.");
  } else if (error) {
      console.log("Query error:", error);
  } else {
      console.log("Proposals query successful:", data);
  }
}
run();