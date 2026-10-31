import type { ReactNode } from "react";
import { Linking, Text } from "react-native";
import { useColors } from "@/components/ui";

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+/gi;
const TRAILING = /[.,!?;:'")\]]+$/;

// Text a man wrote, with web links tappable (opens the browser). Render inside a <Text>
// so the links flow with the surrounding words. Only http(s) links are opened.
export function Linkify({ text }: { text: string }) {
  const c = useColors();
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING, "");
    const start = match.index;
    if (start > last) out.push(text.slice(last, start));
    const href = /^https?:/i.test(url) ? url : `https://${url}`;
    out.push(
      <Text
        key={start}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(href)}
        style={{ color: c.accent, textDecorationLine: "underline" }}
      >
        {url}
      </Text>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
