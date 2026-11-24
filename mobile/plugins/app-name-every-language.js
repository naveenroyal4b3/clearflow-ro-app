// Google Play machine-translates an app's strings into languages the app doesn't provide, and its
// translations of app_name were made when the app was still called "Clearflow RO". Phones in those
// languages (English included) then show the old name. The brand name is the same in every
// language, so give app_name for each of them ourselves; Play only fills in missing languages.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

// Every language Play had translated app_name into (from the APK Play served for build 43), plus
// the app's own languages.
const languages = [
  'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gu', 'hi', 'hr',
  'hu', 'in', 'is', 'it', 'iw', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'nb', 'nl', 'no', 'pa', 'pl', 'pt',
  'ro', 'ru', 'sk', 'sl', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'vi', 'zh', 'zh-rCN', 'zh-rTW', 'zu'
];

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'");

module.exports = function withAppNameEveryLanguage(config) {
  return withDangerousMod(config, ['android', async result => {
    const res = path.join(result.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    for (const language of languages) {
      const dir = path.join(res, `values-${language}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'app_name.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="app_name">${escape(config.name)}</string>\n</resources>\n`);
    }
    return result;
  }]);
};
