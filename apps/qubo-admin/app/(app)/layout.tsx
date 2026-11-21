import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getLocale, getMessages, getTimeZone, getTranslations } from "next-intl/server";
import { Providers } from "@/providers";
import { StaffHint } from "@/components/staff-hint";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell.meta");
  return {
    title: { default: "Qubo", template: "%s · Qubo" },
    description: t("description"),
    applicationName: "Qubo",
    appleWebApp: { capable: true, title: "Qubo", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false, email: false, address: false },
    icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  };
}

// Edge to edge: the top bar paints under the status bar and pads itself with the safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#121212" },
    { media: "(prefers-color-scheme: dark)", color: "#060606" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <Providers locale={locale} messages={messages} timeZone={timeZone}>{children}</Providers>
        <StaffHint />
      </body>
    </html>
  );
}
