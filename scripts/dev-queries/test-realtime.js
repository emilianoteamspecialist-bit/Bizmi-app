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
  const { data, error } = await supabase.rpc('enable_realtime_for_messages');
  console.log("Data:", data, "Error:", error);
}
run();