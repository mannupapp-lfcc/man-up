"use server";

import { redirect } from "next/navigation";
import { CONTACT_EMAIL } from "@manup/shared";
import { mailConfigured, sendSupportMessage } from "@/lib/mail";

const back = (key: "error" | "notice", text: string) => redirect(`/support?${key}=${encodeURIComponent(text)}`);

// Public, no sign-in. Spam guards: a hidden field people never fill, and a form
// sent faster than a person could type is dropped. Both look like success to a bot.
export async function sendSupport(formData: FormData) {
  const sent = "Thanks. Your message was sent, and we will reply by email.";
  if (String(formData.get("website") ?? "")) back("notice", sent);
  const shownAt = Number(formData.get("t") ?? 0);
  if (!shownAt || Date.now() - shownAt < 3000) back("notice", sent);

  // One line, no control characters (it goes into the email subject).
  const name = String(formData.get("name") ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 100);
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  const message = String(formData.get("message") ?? "").trim();

  if (!name) back("error", "Enter your name.");
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) back("error", "Enter a valid email address so we can reply.");
  if (message.length < 10) back("error", "Tell us a little more (at least 10 characters).");
  if (message.length > 5000) back("error", "Keep your message under 5,000 characters.");
  if (!mailConfigured()) back("error", `The form is not set up yet. Email us at ${CONTACT_EMAIL}.`);

  try {
    await sendSupportMessage({ name, email, message });
  } catch {
    back("error", `Your message could not be sent. Please email us at ${CONTACT_EMAIL}.`);
  }
  back("notice", sent);
}
