import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 0.5,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#FDFBF7",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "AP2 — Autonomous Purchase Protocol | Razorpay UPI",
  description:
    "Governed autonomous agentic commerce with zero unsupervised money movement. Built on the Deterministic Sandwich Architecture for Razorpay UPI Autopay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} antialiased`}
    >
      <body className="min-h-[100dvh] flex flex-col overflow-x-hidden">
        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
