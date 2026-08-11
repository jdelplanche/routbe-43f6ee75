const { supabaseAdmin } = await import('../src/integrations/supabase/client.server.ts');
const { data, error } = await supabaseAdmin.from('profiles').select('count').limit(1).single();
console.log('error:', error?.message ?? 'none');
