import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes('placeholder') &&
  !rawUrl.includes('seu-projeto') &&
  !rawKey.includes('placeholder') &&
  rawUrl.startsWith('https://')
);

// Fallback seguro caso o .env ainda não tenha as credenciais reais
const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
