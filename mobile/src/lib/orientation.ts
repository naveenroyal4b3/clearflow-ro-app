import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Dimensions } from 'react-native';

// The manifest no longer locks the orientation, so tablets, foldables and Chromebooks can rotate and
// resize freely (Android 16 ignores such locks on large screens anyway, and Google Play flags them).
// Phones keep the portrait layout the screens are designed for: lock at run time when the shorter
// side of the screen is under 600 dp, Android's usual phone/tablet boundary.
export function usePhonePortrait() {
  useEffect(() => {
    const { width, height } = Dimensions.get('screen');
    if (Math.min(width, height) < 600) ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
}
