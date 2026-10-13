import "server-only";
import nodemailer from "nodemailer";
import { CONTACT_EMAIL } from "@manup/shared";

// Outbound email for the public support form only (Kevin signed off on SMTP for
// this; see CLAUDE.md). Nothing from the app's database is ever sent here: the
// message is what the visitor typed, emailed once and not stored.
//
// Server only: MAIL_HOST, MAIL_PORT (465 = TLS, 587 = STARTTLS), GOOGLE_EMAIL (the
// sending account), GOOGLE_EMAIL_PASSWORD (its app password), SUPPORT_TO (who gets
// the messages, comma separated; falls back to the ministry's contact email).

export function mailConfigured() {
  return !!(process.env.MAIL_HOST && process.env.GOOGLE_EMAIL && process.env.GOOGLE_EMAIL_PASSWORD);
}

function transport() {
  const port = Number(process.env.MAIL_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.GOOGLE_EMAIL, pass: process.env.GOOGLE_EMAIL_PASSWORD },
  });
}

// Signs in to the mail server without sending anything (for checking the setup).
export async function verifyMail() {
  await transport().verify();
}

export async function sendSupportMessage(msg: { name: string; email: string; message: string }) {
  await transport().sendMail({
    from: { name: "Man Up support form", address: process.env.GOOGLE_EMAIL! },
    to: process.env.SUPPORT_TO || CONTACT_EMAIL,
    replyTo: { name: msg.name, address: msg.email },
    subject: `Man Up support: ${msg.name}`,
    text: `${msg.message}\n\n--\nFrom: ${msg.name} <${msg.email}>\nSent from the Man Up support page.`,
  });
}
