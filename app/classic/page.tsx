import type { Metadata, Viewport } from "next";
import Classic from "@/components/classic/Classic";
import "./classic.css";

export const metadata: Metadata = {
  title: "Vila Leku — Living in harmony",
  description: "Vila Leku: a modern Castro. Townhouses and villas around a village heart in Leceia, Oeiras — by Phidias.",
};

export const viewport: Viewport = {
  themeColor: "#e5e3d7",
};

/** The classic site: the same story without the 3D (no canvas, no three.js on this route). */
export default function ClassicPage() {
  return <Classic />;
}
