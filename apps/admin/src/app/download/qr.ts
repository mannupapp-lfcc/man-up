import "server-only";
import QRCode from "qrcode";

export const APP_STORE_URL = "https://apps.apple.com/app/man-up-lfcc/id6817103225";

// Generated on the server; no third-party QR service is called. Black on white with a
// quiet zone, so it scans reliably when printed.
export function appStoreQrSvg(): Promise<string> {
  return QRCode.toString(APP_STORE_URL, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
