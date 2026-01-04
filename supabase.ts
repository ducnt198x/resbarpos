import { createClient } from '@supabase/supabase-js';

// Safe environment variable access for browser ESM
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key] || import.meta.env[`VITE_${key}`];
  }
  return '';
};

// Use localStorage settings if available, otherwise use provided credentials or env vars
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('sb_url') : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('sb_key') : '';

// UPDATED: Default to the provided project credentials if not in localStorage/Env
const DEFAULT_URL = 'https://ddtcrhmpuwkrykopcdgy.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGNyaG1wdXdrcnlrb3BjZGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzUyNzQsImV4cCI6MjA4Mjk1MTI3NH0.fRiktr4dyulelEDmwGPyHwWtbWVn2yLNAVCFJY6JCQA';

const supabaseUrl = storedUrl || getEnv('SUPABASE_URL') || DEFAULT_URL;
const supabaseKey = storedKey || getEnv('SUPABASE_ANON_KEY') || DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isSupabaseConfigured = () => {
    return supabaseUrl !== 'https://placeholder.supabase.co' && supabaseUrl !== '' && supabaseKey !== 'placeholder' && supabaseKey !== '';
};