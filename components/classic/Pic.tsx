import Image from "next/image";
import type { Photo } from "@/lib/classic-content";

/**
 * One photo through next/image (AVIF / WebP, sized to the layout). CSS decides
 * the frame (object-fit: cover fills it); `sizes` says how wide it shows.
 */
export function Pic({
  photo,
  sizes,
  className,
  eager = false,
  decorative = false,
}: {
  photo: Photo;
  sizes: string;
  className?: string;
  eager?: boolean;
  decorative?: boolean;
}) {
  return (
    <Image
      src={photo.src}
      alt={decorative ? "" : photo.alt}
      width={photo.w}
      height={photo.h}
      sizes={sizes}
      quality={80}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      draggable={false}
    />
  );
}

/** The brand arch (components/ui/Brand ARCH_PATH) as a clip path for any box: `clip-path: url(#vc-arch)`. */
export function ArchClip() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <clipPath id="vc-arch" clipPathUnits="objectBoundingBox">
          <path d={ARCH_BOX} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** ARCH_PATH's superellipse in a 1 × 1 box. */
export const ARCH_BOX = (() => {
  const pts: string[] = ["M0 1", "L0 0"];
  for (let i = 1; i <= 64; i++) {
    const phi = (i / 64) * (Math.PI / 2);
    const x = Math.pow(Math.sin(phi), 2 / 2.4);
    const y = 1 - Math.pow(Math.cos(phi), 2 / 2.4);
    pts.push(`L${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  return pts.join(" ") + " Z";
})();
