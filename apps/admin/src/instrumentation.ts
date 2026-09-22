import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

// Server and edge errors, including the Inngest jobs served from api/inngest.
export function register() {
  Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
