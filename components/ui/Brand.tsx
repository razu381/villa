/** The brand marks are white masks — tinted here with currentColor via CSS mask-image. */

export function Wordmark({ className = "", label = "Vila Leku" }: { className?: string; label?: string | null }) {
  return label ? (
    <span className={`vl-wordmark ${className}`} role="img" aria-label={label} />
  ) : (
    <span className={`vl-wordmark ${className}`} aria-hidden="true" />
  );
}

export function PhidiasMark({ className = "" }: { className?: string }) {
  return <span className={`vl-phidias ${className}`} role="img" aria-label="Phidias" />;
}

/** The developer's full lockup (emblem, wordmark, "building harmony" tagline) — the client's own file, white on transparent, tinted via currentColor like the others. */
export function PhidiasTagline({ className = "" }: { className?: string }) {
  return <span className={`vl-phidias-tag ${className}`} role="img" aria-label="Phidias — building harmony" />;
}

/** One brand arch as a path in a 100 × 112 box (superellipse n ≈ 2.4, fitted to brand/arches.png). */
export const ARCH_PATH = (() => {
  const w = 100;
  const h = 112;
  const pts: string[] = [`M0 ${h}`, "L0 0"];
  for (let i = 1; i <= 64; i++) {
    const phi = (i / 64) * (Math.PI / 2);
    const x = w * Math.pow(Math.sin(phi), 2 / 2.4);
    const y = h - h * Math.pow(Math.cos(phi), 2 / 2.4);
    pts.push(`L${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
})();
