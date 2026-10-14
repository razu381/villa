import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode double-mounts the WebGL canvas in dev; keep it off so the
  // scene initialises once (all effects still clean up correctly).
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
