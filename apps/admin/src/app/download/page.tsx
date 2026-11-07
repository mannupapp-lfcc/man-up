import type { Metadata } from "next";
import Image from "next/image";
import { APP_STORE_URL, appStoreQrSvg } from "./qr";

export const metadata: Metadata = { title: "Get the app - Man Up" };

// Public page (no sign-in): scan to open the Man Up listing on the App Store.
export default async function DownloadPage() {
  const svg = await appStoreQrSvg();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 py-10 text-center">
      <Image src="/logo.png" alt="Man Up" width={64} height={64} className="mb-4 rounded-xl" />
      <h1 className="text-3xl font-bold">Get the Man Up app</h1>
      <p className="mt-2 text-sm text-neutral-500">Scan with your iPhone camera to open the App Store.</p>

      <div
        role="img"
        aria-label="QR code for the Man Up app on the App Store"
        className="mt-8 w-full max-w-xs rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <a
        href={APP_STORE_URL}
        className="mt-8 rounded-lg bg-gold px-5 py-3 font-semibold text-black hover:bg-gold-light"
      >
        Open in the App Store
      </a>
      <a href="/download/qr.svg" className="mt-4 text-sm underline">
        Download QR code (SVG)
      </a>
    </main>
  );
}
