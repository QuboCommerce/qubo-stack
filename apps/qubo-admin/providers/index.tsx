"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { ThemeProvider } from "next-themes";
import type { AdminLocale } from "@/i18n/config";
import { Toaster } from "sonner";
import { useState, type ReactNode } from "react";

export function Providers({ children, locale, messages, timeZone }: { children: ReactNode; locale: AdminLocale; messages: AbstractIntlMessages; timeZone: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
