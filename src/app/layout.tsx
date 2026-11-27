import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppProvider } from "@/store/AppProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/AppShell";

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const fraunces = localFont({
  src: "./fonts/Fraunces-Variable.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

// Devanagari support for Hindi text, bundled locally so it works offline and
// on devices without a Hindi system font.
const devanagari = localFont({
  src: "./fonts/NotoSansDevanagari-Variable.woff2",
  variable: "--font-devanagari",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VoiceBill — Just speak, get your bill",
    template: "%s · VoiceBill",
  },
  description:
    "Voice-powered billing for Indian kirana shops. Speak the items in Hindi, Hinglish or English, review the matched prices and print the bill. No sign-up, no API keys, data stays in this browser.",
  applicationName: "VoiceBill",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VoiceBill",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${fraunces.variable} ${devanagari.variable}`}>
      <body className="antialiased">
        <AppProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
