"use client";

/**
 * The photos' loader (next.config `images.loaderFile`). The site is a static
 * export, so nothing resizes on request: every photo is a WebP made at build
 * time in each width of lib/image-sizes.json (scripts/export-images.mjs), at
 * `/_img/<path without extension>-<width>.webp`. In development, the original.
 */
export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (process.env.NODE_ENV === "development") return `${src}?w=${width}`;
  return `/_img${src.replace(/\.(jpe?g|png)$/i, "")}-${width}.webp`;
}
