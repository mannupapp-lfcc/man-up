import type { Metadata } from "next";
import { PRIVACY_POLICY } from "@manup/shared";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy - Man Up" };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_POLICY} />;
}
