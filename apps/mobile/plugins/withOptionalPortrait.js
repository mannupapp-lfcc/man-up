// The portrait orientation lock makes Android infer a required
// android.hardware.screen.portrait feature, which Play uses to hide the app from
// tablets, Chromebooks, and XR devices. Declare it optional; the app stays portrait.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] ?? []).filter(
      (f) => f.$['android:name'] !== FEATURE,
    );
    manifest['uses-feature'].push({
      $: { 'android:name': FEATURE, 'android:required': 'false' },
    });
    return cfg;
  });
};
