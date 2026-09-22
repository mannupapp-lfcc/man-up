import Image from "next/image";
import type { LegalDoc } from "@manup/shared";

// Public page for the store listings (no sign-in). Same text the app shows.
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Image src="/logo.png" alt="Man Up" width={64} height={64} className="mb-4 rounded-xl" />
      <h1 className="text-3xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">Man Up, Love First Christian Center. Updated {doc.updated}.</p>
      <p className="mt-6">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-xl font-semibold">{s.heading}</h2>
          {s.paragraphs.map((p) => <p key={p} className="mt-3 leading-relaxed">{p}</p>)}
        </section>
      ))}
    </main>
  );
}
