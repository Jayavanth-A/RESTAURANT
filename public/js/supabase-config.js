/**
 * Supabase Configuration — Dheeran Restaurant
 */

const SUPABASE_URL = 'https://isamfamwrrtkrfrmewto.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RXzfAbcFjgoZjBxympcRiw_edz8AUO9';

let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }
  console.error('Supabase client not loaded.');
  return null;
}

const RESTAURANT_ID = 'dheeran-001';
