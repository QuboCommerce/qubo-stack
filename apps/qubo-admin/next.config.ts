import type { NextConfig } from "next";

// Hosts allowed to load dev assets/HMR (set by scripts/dev/qd, e.g. dev.by-ali.dev).
const devOrigins = (process.env.QUBO_DEV_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["postgres"],
  output: "standalone",
  // The panel is never indexed, on any host.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
