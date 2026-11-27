import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The sandboxed preview is served from an e2b.app subdomain; allow the dev
  // server assets to load there as well as from localhost.
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0", "*.e2b.app"],
};

export default nextConfig;
