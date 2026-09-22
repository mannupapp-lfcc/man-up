import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // @manup/shared ships TypeScript source; let Next compile it.
  transpilePackages: ["@manup/shared"],
};

// Source maps upload only when SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are
// set (Vercel production); local builds skip it.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
