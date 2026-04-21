import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  verification: {
    google: "uRTAz7j8N8jDW5BzJaGn-wzrFY5C7KNStVLMKlGzo_4",
  },
  title: "QR Code Generator - Create QR Codes Free | qr-generator",
  description:
    "Free online QR code generator. Create QR codes for URLs, text, email, phone, WiFi, and vCard. Customize colors and size, then download as PNG or SVG instantly.",
  keywords: [
    "qr code generator",
    "create qr code",
    "qr code maker",
    "free qr code",
    "qr generator online",
    "custom qr code",
  ],
  authors: [{ name: "qr-generator" }],
  openGraph: {
    title: "QR Code Generator - Create QR Codes Free",
    description:
      "Free online QR code generator. Customize colors, size, and download as PNG or SVG.",
    url: "https://qr-generator-nao.vercel.app",
    siteName: "qr-generator",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "QR Code Generator - Create QR Codes Free",
    description:
      "Free online QR code generator. Customize colors, size, and download as PNG or SVG.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://qr-generator-nao.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "QR Code Generator",
              description:
                "Free online QR code generator. Create QR codes for URLs, text, email, phone, WiFi, and vCard. Customize colors and download as PNG or SVG.",
              url: "https://qr-generator-nao.vercel.app",
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Any",
              browserRequirements: "Requires JavaScript",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "QR code generation for URLs, text, email, phone, WiFi, vCard",
                "Customizable foreground and background colors",
                "Adjustable QR code size",
                "Download as PNG or SVG",
                "No signup required",
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
