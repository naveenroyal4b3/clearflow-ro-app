# Google Play preparation

## Android build

The signed release bundle is built in GitHub Actions. Run **Build Android release** from the Actions tab; it uploads `clearflow-release-aab-<run number>` as a workflow artifact. The workflow:

- generates the Android project and icons, targets Android API 36, and turns off `allowBackup`
- sets `versionName` from `package.json` and `versionCode` from the workflow run number, so every run can be uploaded
- signs the bundle with the upload key from the `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` repository secrets (key alias `upload`)

Every push to `main` also builds a debug APK (**Build Android APK**) for testing on devices.

To build locally instead, install Node.js LTS and Android Studio with Android SDK Platform 36, then run:

```powershell
npm install
npx cap add android
npm run android:sync
npx cap open android
```

The `android/` folder is generated and not committed. A local build needs the same changes the workflow makes: `allowBackup="false"`, a version code higher than the last upload, and signing with the upload key.

The app ID is `com.naveenroyal4b3.clearflow`. It cannot be changed after publishing. Keep the upload keystore and its password private and backed up outside this repository.

## Done

- Supabase sign-in, team invitations, password reset, and role-based access, with each business's data kept separate
- In-app account deletion (More, then My account) and a public account deletion page
- Privacy policy and terms of service, hosted with the web app on GitHub Pages (`public/privacy.html`, `public/terms.html`, `public/delete-account.html`)
- Signed release bundle targeting API 36

## Before submitting

- Create the Play Console app and enter the privacy policy URL and the account deletion URL from GitHub Pages.
- Complete the Data safety form to match the privacy policy. The app collects account details (name, email, phone), business and customer records, feedback, an activity log, and error reports. Data is encrypted in transit, users can request deletion, and nothing is shared for advertising. Supabase, Brevo, and GitHub Pages are the service providers.
- Complete the content rating questionnaire and the target audience section (adults; not directed at children).
- Provide a reviewer login under App access, since the app requires sign-in.
- Prepare the store listing: description, screenshots, 1024 x 500 feature graphic, 512 x 512 icon, and a support email.
- Test the signed bundle on physical Android devices and complete the Play Console testing requirements for the developer account, such as the closed test required for new personal accounts.
