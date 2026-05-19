import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DebugPanelLoader } from "@/components/debugPanelLoader";
import { Providers } from "@/components/providers";
import { SessionKeepalive } from "@/components/sessionKeepalive";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rise Rich",
  description: "Solana trading on Privy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SessionKeepalive />
          {children}
          <DebugPanelLoader />
        </Providers>
      </body>
    </html>
  );
}
