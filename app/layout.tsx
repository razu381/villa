import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vilaleku.com"),
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
      <body>
        {/* Google Tag Manager (client's GA4/Vilaleku - GA4.txt, container GTM-K59NNWBH). */}
        <Script id="gtm" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K59NNWBH');`}
        </Script>
        <noscript>
          <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-K59NNWBH" height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
        </noscript>
        {children}
      </body>
    </html>
  );
}
