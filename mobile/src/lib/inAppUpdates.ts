import * as InAppUpdates from 'expo-in-app-updates';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

// Checks Google Play for a newer version when the app opens or comes back to the screen (at most
// once an hour), and shows Play's own update screen when there is one. Play only offers this to
// apps installed from Play, so it does nothing in development builds.
const checkEvery = 60 * 60 * 1000;
let lastCheck = 0;

async function checkForUpdate() {
  if (Date.now() - lastCheck < checkEvery) return;
  lastCheck = Date.now();
  try {
    // Immediate (full-screen) when Play allows it, otherwise Play's flexible download.
    await InAppUpdates.checkAndStartUpdate(true);
  } catch {
    // No Play Store, offline or not installed from Play: try again later.
    lastCheck = 0;
  }
}

export function useInAppUpdates() {
  useEffect(() => {
    if (__DEV__ || Platform.OS !== 'android') return;
    checkForUpdate();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') checkForUpdate(); });
    return () => subscription.remove();
  }, []);
}
