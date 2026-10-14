import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/instrument-sans/index.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  title: "Vila Leku — Living in harmony",
  description: "A contemporary village above the Lisbon coast. Leceia, Oeiras — by Phidias.",
  openGraph: {
    title: "Vila Leku — Living in harmony",
    description: "A contemporary village above the Lisbon coast.",
    images: ["/media/aerial-village.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The first frame is the film; ToneSync retints this as the day unfolds.
  themeColor: "#2a2b22",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
