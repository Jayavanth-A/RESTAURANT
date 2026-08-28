/**
 * Supabase Configuration — Dheeran Restaurant
 * This file MUST load AFTER the Supabase CDN script.
 */

// RESTAURANT_ID — defined first, always available
const RESTAURANT_ID = 'dheeran-001';

const SUPABASE_URL = 'https://isamfamwrrtkrfrmewto.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RXzfAbcFjgoZjBxympcRiw_edz8AUO9';

let _supabaseClient = null;

function getSupabase() {
  if (_supabaseClient) return _supabaseClient;

  if (typeof window !== 'undefined') {
    // Supabase UMD bundle creates window.supabase with createClient
    const lib = window.supabase || window.Supabase;
    if (lib && typeof lib.createClient === 'function') {
      _supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return _supabaseClient;
    }
  }

  console.error('Supabase JS library not loaded. Check CDN script tag.');
  return null;
}
