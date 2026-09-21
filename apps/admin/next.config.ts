import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @manup/shared ships TypeScript source; let Next compile it.
  transpilePackages: ["@manup/shared"],
};

export default nextConfig;
