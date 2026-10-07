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
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      id,
      freelancer_id,
      profiles (
        id,
        full_name
      )
    `).limit(1);
    
  console.log("Profiles join Data:", data);
  console.log("Profiles join Error:", error);
  
  const { data: d2, error: e2 } = await supabase
    .from("proposals")
    .select(`
      id,
      freelancer_id,
      profiles!proposals_freelancer_id_fkey (
        id,
        full_name
      )
    `).limit(1);
    
  console.log("Explicit FK Data:", d2);
  console.log("Explicit FK Error:", e2);
}
run();