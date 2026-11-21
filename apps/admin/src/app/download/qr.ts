import "server-only";
import QRCode from "qrcode";

export const APP_STORE_URL = "https://apps.apple.com/app/man-up-lfcc/id6817103225";
export const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=org.lfcc.manup";

// Generated on the server; no third-party QR service is called. Black on white with a
// quiet zone, so it scans reliably when printed.
function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export function appStoreQrSvg(): Promise<string> {
  return qrSvg(APP_STORE_URL);
}

export function googlePlayQrSvg(): Promise<string> {
  return qrSvg(GOOGLE_PLAY_URL);
}
