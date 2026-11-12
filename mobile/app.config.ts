import type { ExpoConfig } from 'expo/config';

// The release workflow sets ANDROID_VERSION_CODE (GitHub run number) so every Play upload is higher
// than the last. The Capacitor app already used codes up to 5, so local builds start above that.
const versionCode = Number(process.env.ANDROID_VERSION_CODE) || 100;

const config: ExpoConfig = {
  name: 'Clearflow RO',
  slug: 'clearflow-ro',
  version: '2.0.0',
  scheme: 'clearflow',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  android: {
    // Same package as the Play Store listing, so this app installs as an update.
    package: 'com.naveenroyal4b3.clearflow',
    versionCode,
    // Keep login sessions and cached business data out of device and cloud backups.
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png'
    },
    // The app shows no ads; keep libraries from adding the advertising ID permission.
    blockedPermissions: ['com.google.android.gms.permission.AD_ID'],
    predictiveBackGestureEnabled: false
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-sharing',
    // Release builds: R8 removes unused code and resources, so the app is smaller and faster.
    // The keep rules cover code that native libraries reach only through JNI or reflection.
    ['expo-build-properties', {
      android: {
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        extraProguardRules: [
          '-keep class com.margelo.nitro.** { *; }',
          '-dontwarn com.margelo.nitro.**',
          '-if class androidx.credentials.CredentialManager',
          '-keep class androidx.credentials.playservices.** { *; }'
        ].join('\n')
      }
    }],
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#f5f7f4' }]
  ],
  experiments: { typedRoutes: true }
};

export default config;
