import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We cannot use output: 'export' because we have dynamic routes /[token] fetching from DB
  serverExternalPackages: ["firebase-admin"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
