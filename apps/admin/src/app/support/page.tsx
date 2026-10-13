import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CONTACT_EMAIL } from "@manup/shared";
import { Flash, Label, Submit, inputClass } from "@/components/ui";
import { sendSupport } from "./actions";

export const metadata: Metadata = { title: "Support - Man Up" };

// When the form was shown, for the too-fast spam check. Kept out of the component
// body (render must stay pure); the page is dynamic, so it runs per request.
const formShownAt = () => Date.now();

// Public support page (no sign-in): the App Store and Google Play support URL.
export default async function SupportPage({ searchParams }: PageProps<"/support">) {
  const { error, notice } = await searchParams;
  const shownAt = formShownAt();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Image src="/logo.png" alt="Man Up" width={64} height={64} className="mb-4 rounded-xl" />
      <h1 className="text-3xl font-bold">Support</h1>
      <p className="mt-1 text-sm text-neutral-500">Man Up, Love First Christian Center.</p>
      <p className="mt-6">
        Questions about the Man Up app, trouble signing in, or anything else? Send us a message and we will reply by
        email. You can also write to <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
      </p>
      <p className="mt-3 text-sm text-neutral-500">
        To delete your account, open the app and go to More, Settings, Delete account. If someone is in danger, call 911.
      </p>

      <div className="mt-6"><Flash error={error} notice={notice} /></div>

      <form action={sendSupport} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="t" value={shownAt} />
        {/* Hidden from people; bots fill it in. */}
        <div aria-hidden="true" className="hidden">
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <Label text="Name">
          <input name="name" required maxLength={100} autoComplete="name" className={inputClass} />
        </Label>
        <Label text="Email">
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
        </Label>
        <Label text="Message">
          <textarea name="message" required minLength={10} maxLength={5000} rows={6} className={inputClass} />
        </Label>
        <div><Submit>Send message</Submit></div>
      </form>

      <p className="mt-8 text-sm text-neutral-500">
        <Link href="/privacy" className="underline">Privacy Policy</Link>
        {" | "}
        <Link href="/guidelines" className="underline">Community Guidelines</Link>
      </p>
    </main>
  );
}
