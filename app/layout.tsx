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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
