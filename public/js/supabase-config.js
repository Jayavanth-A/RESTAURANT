/**
 * Supabase Configuration — Dheeran Restaurant
 * This file MUST load AFTER the Supabase CDN script.
 */

// RESTAURANT_ID — defined early so it's always available
const RESTAURANT_ID = 'dheeran-001';

const SUPABASE_URL = 'https://isamfamwrrtkrfrmewto.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RXzfAbcFjgoZjBxympcRiw_edz8AUO9';

let _supabaseClient = null;

function getSupabase() {
  if (_supabaseClient) return _supabaseClient;

  // Try to use the globally loaded Supabase JS library
  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabaseClient;
  }

  // Try alternate global name
  if (typeof window !== 'undefined' && window.Supabase && typeof window.Supabase.createClient === 'function') {
    _supabaseClient = window.Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabaseClient;
  }

  console.error('Supabase JS library not loaded. Check that the CDN script is included.');
  return null;
}
