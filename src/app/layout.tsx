import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "HANAZO — Nigerian Pre-Dispatch Parcel Clustering",
  description: "Next-generation pre-dispatch sorting and automated bin allocation engine powered by NIPOST NDAPS.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hanazo",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4A017",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-[#0A0A0A] text-neutral-100 antialiased">
      <body className="min-h-dvh flex flex-col bg-[#0A0A0A] text-neutral-100">
        <ServiceWorkerRegister />
        <header className="sticky top-0 z-40 border-b border-neutral-900 bg-[#0A0A0A]/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-sm"
            >
              <div className="size-7 rounded bg-amber-500 flex items-center justify-center font-black text-black text-sm tracking-wider">
                H
              </div>
              <span className="font-extrabold tracking-wider text-lg text-white">
                HANAZO
              </span>
            </Link>

            <nav className="flex items-center gap-4 text-xs font-medium text-neutral-400">
              <Link
                href="/"
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded px-2 py-1"
              >
                Hubs
              </Link>
              <NetworkStatusIndicator />
            </nav>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>
        <PWAInstallBanner />
      </body>
    </html>
  );
}
