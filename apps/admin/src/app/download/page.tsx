import type { Metadata } from "next";
import Image from "next/image";
import { APP_STORE_URL, GOOGLE_PLAY_URL, appStoreQrSvg, googlePlayQrSvg } from "./qr";

export const metadata: Metadata = { title: "Get the app - Man Up" };

type Store = {
  name: string;
  hint: string;
  url: string;
  svg: string;
  svgPath: string;
};

// Public page (no sign-in): scan to open the Man Up listing on the App Store or Google Play.
export default async function DownloadPage() {
  const [iosSvg, androidSvg] = await Promise.all([appStoreQrSvg(), googlePlayQrSvg()]);

  const stores: Store[] = [
    {
      name: "App Store",
      hint: "iPhone",
      url: APP_STORE_URL,
      svg: iosSvg,
      svgPath: "/download/qr.svg",
    },
    {
      name: "Google Play",
      hint: "Android",
      url: GOOGLE_PLAY_URL,
      svg: androidSvg,
      svgPath: "/download/android/qr.svg",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-10 text-center">
      <Image src="/logo.png" alt="Man Up" width={64} height={64} className="mb-4 rounded-xl" />
      <h1 className="text-3xl font-bold">Get the Man Up app</h1>
      <p className="mt-2 text-sm text-neutral-500">Scan the code for your phone with its camera.</p>

      <div className="mt-8 grid w-full grid-cols-2 gap-4 sm:gap-10">
        {stores.map((s) => (
          <section key={s.name} className="flex flex-col items-center">
            <h2 className="text-xl font-semibold">{s.hint}</h2>
            <div
              role="img"
              aria-label={`QR code for the Man Up app on ${s.name}`}
              className="mt-4 w-full max-w-xs rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: s.svg }}
            />
            <a
              href={s.url}
              className="mt-6 rounded-lg bg-gold px-3 py-3 text-sm font-semibold text-black hover:bg-gold-light sm:px-5 sm:text-base"
            >
              Open in {s.name}
            </a>
            <a href={s.svgPath} className="mt-4 text-sm underline">
              Download QR code (SVG)
            </a>
          </section>
        ))}
      </div>
    </main>
  );
}
