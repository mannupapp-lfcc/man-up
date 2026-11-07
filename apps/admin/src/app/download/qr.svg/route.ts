import { appStoreQrSvg } from "../qr";

// The QR code as a standalone SVG, for flyers and slides.
export async function GET() {
  return new Response(await appStoreQrSvg(), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": 'attachment; filename="man-up-app-store-qr.svg"',
    },
  });
}
