import type { Metadata } from "next";
import { COMMUNITY_GUIDELINES } from "@manup/shared";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Community Guidelines - Man Up" };

export default function GuidelinesPage() {
  return <LegalPage doc={COMMUNITY_GUIDELINES} />;
}
