import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";
import { NextResponse, type NextRequest } from "next/server";
import { syncContentFromSanity } from "@/lib/sanity/sync";
import { createServiceClient } from "@/lib/supabase/service";

// Sanity calls this on publish, unpublish, and delete (GROQ-powered webhook). The
// signature proves it came from Sanity; the body is ignored beyond that, because we
// re-read the published content from Sanity and mirror all of it.
export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook secret not configured", { status: 500 });

  const body = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER_NAME) ?? "";
  if (!(await isValidSignature(body, signature, secret))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const summary = await syncContentFromSanity(createServiceClient());
    return NextResponse.json(summary);
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
