import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Reports an unexpected error to the client_errors table. Never throws; at most a few per launch.
let sent = 0;
export async function reportError(error: unknown, page = '') {
  if (sent >= 5) return;
  sent += 1;
  const value = error as { message?: unknown; stack?: unknown } | null;
  try {
    await supabase.from('client_errors').insert({
      message: String(value?.message || error || 'Unknown error').slice(0, 2000),
      stack: String(value?.stack || '').slice(0, 8000),
      page: page.slice(0, 500),
      user_agent: `ClearflowNative/${Platform.OS} ${Platform.Version}`.slice(0, 500),
      app_version: String(Constants.expoConfig?.version || '').slice(0, 40)
    });
  } catch {
    // Best effort.
  }
}
