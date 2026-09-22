import * as Sentry from "@sentry/react-native";

// Crash and error reporting. Nothing a man writes may reach Sentry (Non-negotiable
// 2): no default PII, no console breadcrumbs (which could echo a message), and no
// session replay. Off when EXPO_PUBLIC_SENTRY_DSN is unset (local development).
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN && !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
});

export { Sentry };
