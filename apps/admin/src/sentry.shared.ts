// Sentry options shared by the browser, server, and edge runtimes. No default PII and
// no console breadcrumbs: admin pages and jobs handle men's names and report text,
// and none of it belongs in an error tracker (Non-negotiable 2). Off without a DSN.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeBreadcrumb: <T extends { category?: string }>(crumb: T) => (crumb.category === "console" ? null : crumb),
};
