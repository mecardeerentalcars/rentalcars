import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "A simple, premium rental car management dashboard for daily fleet, customer, rental, payment and expense operations.";

  return {
    metadataBase: new URL(origin),
    title: "Mecardee — Rental management, made simple",
    description,
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: "Mecardee — Rental management, made simple",
      description,
      type: "website",
      images: [{ url: `${origin}/og-ai.png`, width: 1733, height: 909, alt: "Mecardee mobile rental management app" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Mecardee — Rental management, made simple",
      description,
      images: [`${origin}/og-ai.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#5d50cf" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mecardee" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/mecardee-180.png" />
              {/* MECARDEE_FIRST_PAINT_CRITICAL_V8_9_74 */}
        <style>{`
          html,body{margin:0;min-height:100%;background:#f5f6fb}
          .mecardee-first-paint{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:linear-gradient(180deg,#f8f8fc 0%,#f3f4f9 100%);opacity:1;visibility:visible;transition:opacity .14s ease,visibility .14s ease}
          .mecardee-first-paint-progress{position:absolute;top:0;left:0;right:0;height:3px;overflow:hidden;background:rgba(93,80,207,.08)}
          .mecardee-first-paint-progress span{display:block;width:34%;height:100%;background:#5d50cf;animation:mecardeeFirstPaint 1s ease-in-out infinite}
          .mecardee-first-paint-brand{display:flex;align-items:center;gap:12px;color:#1f2725;font-family:Arial,sans-serif;font-size:18px}
          .mecardee-first-paint-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(145deg,#755ee7,#5444c5);color:#fff;font-family:Georgia,serif;font-size:21px;font-weight:700;box-shadow:0 8px 24px rgba(84,68,197,.18)}
          body:has(.app-shell) .mecardee-first-paint,body:has(.mecardee-auth-card:not(.is-loading)) .mecardee-first-paint{opacity:0;visibility:hidden;pointer-events:none}
          @keyframes mecardeeFirstPaint{0%{transform:translateX(-120%)}55%{transform:translateX(150%)}100%{transform:translateX(310%)}}
        `}</style>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* MECARDEE_GOOGLE_STYLE_HARD_RELOAD_LAYOUT_V8_9_74 */}
        <div className="mecardee-first-paint" aria-hidden="true">
          <div className="mecardee-first-paint-progress"><span /></div>
          <div className="mecardee-first-paint-brand">
            <span className="mecardee-first-paint-mark">M</span>
            <strong>Mecardee</strong>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
