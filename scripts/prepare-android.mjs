// Applies this app's changes to a freshly generated Capacitor Android project. The android/ folder
// is not committed, so `npm run android:add` runs this right after `cap add android`.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';

// Native code the app adds, such as the print plugin.
cpSync('android-overrides', 'android', { recursive: true });

// Keep login sessions and cached business data out of device and cloud backups.
const manifest = 'android/app/src/main/AndroidManifest.xml';
const xml = readFileSync(manifest, 'utf8').replace('android:allowBackup="true"', 'android:allowBackup="false"');
if (!xml.includes('android:allowBackup="false"')) throw new Error(`Could not turn off allowBackup in ${manifest}`);
writeFileSync(manifest, xml);
