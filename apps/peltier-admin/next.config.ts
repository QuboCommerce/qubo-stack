import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  allowedDevOrigins: ["94.104.198.159"],
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["postgres"],
  output: "standalone",
};

export default nextConfig;
