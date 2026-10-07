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
  // Use a valid user ID from the profiles for p_user_id
  const { data: profiles } = await supabase.from('profiles').select('id');
  const userId = profiles?.[0]?.id || "7b6aab50-c019-44f6-81e8-15772d536c23";
  
  const { data, error } = await supabase.rpc("get_jobs_with_details", {
    p_user_id: userId,
    p_search_query: "",
    p_offset: 0,
    p_limit: 10,
    p_from_date: null,
    p_to_date: null,
    p_max_credits: null,
    p_job_type: null,
    p_category_skills: null,
  });
  console.log("RPC Data:", JSON.stringify(data, null, 2));
  console.log("RPC Error:", error);
}
run();