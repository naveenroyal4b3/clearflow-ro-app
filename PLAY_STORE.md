# Google Play preparation

## Android build

Install Node.js LTS and Android Studio with Android SDK Platform 36. From this folder, run:

```powershell
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, build a signed Android App Bundle (`.aab`) for release. Later rebuilds can use:

```powershell
npm run android:bundle
```

The app ID is `com.naveenroyal4b3.clearflow`. An app ID cannot be changed after publishing, so confirm this identifier before the first release. Keep the upload key and Play signing credentials private and backed up.

## Before submitting

- Replace demo customer, account, job, and product records with production data flows.
- Add secure sign-in, authorization, and a backend. The current prototype stores records only in each device's browser storage; users do not share data across devices, and account rows are not real login accounts.
- Publish a privacy policy at a public URL and provide a support contact. Describe the collection, use, retention, deletion, and protection of customer names, phone numbers, addresses, installation records, and business tax details.
- Create the Play Console app, complete the Data safety and content-rating forms, and prepare the store listing, screenshots, feature graphic, and 512 x 512 app icon.
- Use a release signing key and increment the Android version code for each upload.
- Confirm the generated Android project targets API 36 or higher before upload. Google Play requires API 36 for new Android app submissions from August 31, 2026.
- Test the signed bundle on physical Android devices and complete any Play Console testing requirements for the developer account.

This repository does not contain a generated Android project or signed bundle yet. Those require the Android build tools, a release signing key, and the developer's Play Console account.