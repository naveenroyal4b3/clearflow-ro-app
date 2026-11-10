import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.naveenroyal4b3.clearflow',
  appName: 'Clearflow RO',
  webDir: 'dist',
  plugins: {
    // Only Google sign-in is used. Leaving the others out keeps their SDKs (and the Facebook SDK's
    // advertising-ID permission) out of the app.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false }
    }
  }
};

export default config;