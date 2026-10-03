import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import "../(app)/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio · Qubo" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Full-screen editor: its own root so the admin chrome never mounts.
export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="overflow-hidden font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
