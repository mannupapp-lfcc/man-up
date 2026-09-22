import * as Sentry from "@sentry/react-native";

// Crash and error reporting. Nothing a man writes may reach Sentry (Non-negotiable
// 2): no default PII, no console breadcrumbs (which could echo a message), and no
// session replay.
//
// Only started in release builds with a DSN. Calling init with enabled: false still
// starts the native iOS SDK, which crashed development builds on launch
// (SentrySDK.start, EXC_BAD_ACCESS), so development builds skip init entirely.
// Sentry.wrap is safe without init.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsn && !__DEV__) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
  });
}

export { Sentry };
