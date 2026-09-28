import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "HM Froid — Réfrigération professionnelle depuis 2006",
  description:
    "HM Froid — Solutions de réfrigération professionnelle en Belgique. Chambres froides, vitrines réfrigérées et équipements de froid commercial : vente, installation et maintenance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${anton.variable} min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
