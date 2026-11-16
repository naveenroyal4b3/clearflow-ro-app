// The camera permission makes Google Play assume the app needs a camera, which hides it from
// devices without one (some tablets, Chromebooks and phones). Taking a product photo is optional,
// so declare the camera features as not required.
const { withAndroidManifest } = require('expo/config-plugins');

const features = ['android.hardware.camera', 'android.hardware.camera.any', 'android.hardware.camera.autofocus', 'android.hardware.camera.front'];

module.exports = function withOptionalCamera(config) {
  return withAndroidManifest(config, result => {
    const manifest = result.modResults.manifest;
    const declared = (manifest['uses-feature'] || []).filter(feature => !features.includes(feature.$['android:name']));
    manifest['uses-feature'] = [...declared, ...features.map(name => ({ $: { 'android:name': name, 'android:required': 'false' } }))];
    return result;
  });
};
