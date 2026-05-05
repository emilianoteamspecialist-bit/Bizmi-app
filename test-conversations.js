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
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "7b6aab50-c019-44f6-81e8-15772d536c23";
  
  const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        participant1_id,
        participant2_id,
        participant1_profile:profiles!participant1_id (
          id,
          full_name,
          account_type,
          company_name,
          freelancer_logos(file_name),
          agency_logo(*)
        ),
        participant2_profile:profiles!participant2_id (
          id,
          full_name,
          account_type,
          company_name,
          freelancer_logos(file_name),
          agency_logo(*)
        )
      `)
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

  console.log("Conversations Error:", error);
}
run();