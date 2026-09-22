// Expo's default Metro config (monorepo aware), wrapped by Sentry so release builds
// carry debug ids for source maps.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
