import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
export const configured = Boolean(supabaseUrl && supabaseKey);

// The key is the public one; row-level security protects the data.
export const supabase = createClient(supabaseUrl || 'https://not-configured.invalid', supabaseKey || 'not-configured', {
  auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

// Refresh the session only while the app is on screen.
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
