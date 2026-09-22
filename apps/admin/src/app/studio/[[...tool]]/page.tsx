import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

export { metadata, viewport } from "next-sanity/studio";

// Sanity Studio for content editors. Ministry admins only (layout.tsx), and Sanity
// asks for its own sign-in on top.
export default function StudioPage() {
  return <NextStudio config={config} />;
}
