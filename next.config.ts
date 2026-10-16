import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode double-mounts the WebGL canvas in dev; keep it off so the
  // scene initialises once (all effects still clean up correctly).
  reactStrictMode: false,
  devIndicators: false,
  // Pin the workspace root to this project (also correct inside nested git worktrees).
  turbopack: { root: process.cwd() },
  // The classic site's photos: AVIF first, WebP fallback, one quality.
  images: { formats: ["image/avif", "image/webp"], qualities: [80] },
};

export default nextConfig;
