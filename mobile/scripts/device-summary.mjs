// Reads an app bundle's manifest (from `bundletool dump manifest`) on stdin and prints the parts
// that decide which devices Google Play offers the app to: minimum Android version, required
// hardware features, permissions (Play treats some as required hardware), libraries and screen
// support. The release workflow compares this with the previous release, so a change that would
// drop devices stops the automatic production release.
import { readFileSync } from 'node:fs';

const manifest = readFileSync(0, 'utf8');
const tags = ['uses-sdk', 'uses-feature', 'uses-permission', 'uses-permission-sdk-23', 'uses-library', 'uses-native-library', 'supports-screens', 'compatible-screens', 'uses-configuration', 'supports-gl-texture'];
const lines = new Set();
for (const tag of tags) {
  for (const match of manifest.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))) {
    const attributes = [...match[0].matchAll(/([\w:.-]+)="([^"]*)"/g)]
      .filter(([, name]) => name !== 'android:targetSdkVersion' && name !== 'tools:node')
      .map(([, name, value]) => `${name}=${value}`)
      .sort();
    lines.add(`${tag} ${attributes.join(' ')}`.trim());
  }
}
console.log([...lines].sort().join('\n'));
