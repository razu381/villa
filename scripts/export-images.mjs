#!/usr/bin/env node
/**
 * Before `next build`: every photo under public/media as WebP in each width
 * of lib/image-sizes.json, into public/_img for Vercel and the static export,
 * named as lib/image-loader.ts asks for them. Never wider than the original
 * (a wider width gets the original's size).
 *   node scripts/export-images.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const sizes = JSON.parse(fs.readFileSync(path.join(root, "lib/image-sizes.json"), "utf8"));
const widths = [...sizes.deviceSizes, ...sizes.imageSizes].sort((a, b) => a - b);
const src = path.join(root, "public");
const out = path.join(src, "_img");

const photos = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jpe?g$/i.test(e.name)) photos.push(p);
  }
};
walk(path.join(src, "media"));

let made = 0;
for (const file of photos) {
  const rel = path.relative(src, file).replace(/\.jpe?g$/i, "");
  const { width: original } = await sharp(file).metadata();
  for (const w of widths) {
    const dest = path.join(out, `${rel}-${w}.webp`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(file)
      .resize({ width: Math.min(w, original ?? w) })
      .webp({ quality: 80 })
      .toFile(dest);
    made++;
  }
}
console.log(`export-images: ${photos.length} photos × ${widths.length} widths (${made} made) → public/_img`);
