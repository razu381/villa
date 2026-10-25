import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/instrument-sans/index.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://villa-bay-iota.vercel.app"),
  title: "Vila Leku — Living in harmony",
  description: "Vila Leku: a modern Castro. Townhouses and villas around a village heart in Leceia, Oeiras — by Phidias.",
  openGraph: {
    title: "Vila Leku — Living in harmony",
    description: "A contemporary village above the Lisbon coast.",
    images: ["/media/aerial-village.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The classic site's limestone; the 3D route sets its own.
  themeColor: "#e5e3d7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
