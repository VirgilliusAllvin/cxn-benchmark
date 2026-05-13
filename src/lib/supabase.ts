import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || supabaseUrl.includes('SEU_PROJETO')) {
  console.warn('[Supabase] VITE_SUPABASE_URL não configurado. Edita .env.local com as tuas credenciais.');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
