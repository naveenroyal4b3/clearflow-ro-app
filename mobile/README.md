# Clearflow RO — native Android app

React Native (Expo SDK 58, Expo Router) version of the Clearflow RO app. It replaces the Capacitor
app in phases and uses the same Supabase backend. GST maths and data access are shared with the web
app through `src/lib/shared.ts`, which loads `../src/gst.js` and `../src/supabase-data.js`.

```powershell
cd mobile
npm ci
copy .env.example .env.local   # then fill in the values
npx tsc --noEmit; npx expo lint; npx jest
npx expo run:android           # needs Android Studio / an emulator or device
```

The Native app workflow (mobile.yml) runs the checks and builds an arm64 debug APK whenever the app
or the shared code changes. Payments stay on the
website: the app shows plan status as plain text only (Google Play consumption-only rule).
