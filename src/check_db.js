const fs = require('fs');
const code = fs.readFileSync('./src/services/supabaseClient.ts', 'utf8');
const uMatch = code.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const kMatch = code.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (uMatch && kMatch) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(uMatch[1], kMatch[1]);
  // Use postgres function or direct query to check columns
  supabase.from('customers').select('id').limit(1).then(res => {
    console.log(res);
  });
}
