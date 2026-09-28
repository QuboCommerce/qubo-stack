import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["postgres"],
  output: "standalone",
};

export default nextConfig;
