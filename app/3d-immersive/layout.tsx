import type { Metadata, Viewport } from "next";

/** The 3D journey: reached by its direct link only, never linked from the classic site, never indexed. */
export const metadata: Metadata = {
  description: "A contemporary village above the Lisbon coast. Leceia, Oeiras — by Phidias.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The first frame is the film; ToneSync retints this as the day unfolds.
  themeColor: "#2a2b22",
};

export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
