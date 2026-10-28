import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { WalletModal } from "@/components/wallet/connect";
import { WalletProvider } from "@/components/wallet/provider";
import { SessionProvider } from "@/components/wallet/session";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitSense",
  description: "Split bills with your flatmates or friends at an event, then settle up in USDC on Sui.",
};

export const viewport: Viewport = {
  themeColor: "#eef4fb",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <WalletProvider>
          <SessionProvider>
            {children}
            <Suspense>
              <WalletModal />
            </Suspense>
          </SessionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
