import type { NextConfig } from "next";
import imageSizes from "./lib/image-sizes.json";

const nextConfig: NextConfig = {
  // A static site (out/), hosted as plain files on cPanel behind Cloudflare. Its
  // redirects and headers live in public/.htaccess; `npm start` serves out/.
  output: "export",
  // /3d-immersive/ is a folder with an index.html, which Apache serves as is.
  trailingSlash: true,
  // Strict mode double-mounts the WebGL canvas in dev; keep it off so the
  // scene initialises once (all effects still clean up correctly).
  reactStrictMode: false,
  devIndicators: false,
  // Pin the workspace root to this project (also correct inside nested git worktrees).
  turbopack: { root: process.cwd() },
  // The photos: WebP made at build time in these widths (scripts/export-images.mjs).
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts", qualities: [80], ...imageSizes },
};

export default nextConfig;
