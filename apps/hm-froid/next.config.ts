import type { NextConfig } from "next";

// Hosts allowed to load dev assets/HMR (set by scripts/dev/qd, e.g. qubo-web.by-ali.dev).
const devOrigins = (process.env.QUBO_DEV_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["postgres"],
  output: "standalone",
};

export default nextConfig;
