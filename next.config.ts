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
  // The classic site is the home now; old links to it still land.
  redirects: async () => [{ source: "/classic", destination: "/", permanent: true }],
  // The 3D is a direct link only: kept out of search beside its robots meta
  // (and never listed in a robots.txt, which would publish the path).
  headers: async () => [{ source: "/3d-immersive/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }],
};

export default nextConfig;
