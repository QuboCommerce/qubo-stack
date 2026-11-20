"use client";

import { Languages, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { setLanguage } from "@/app/language-actions";
import { localeNames, locales } from "@/i18n/config";
import { clearStaffHint } from "@/components/staff-hint";
import type { ShellUser } from "./types";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function UserMenu({ user }: { user: ShellUser }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("userMenu");
  const locale = useLocale();
  const [, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg px-1 text-topbar-foreground outline-none hover:bg-topbar-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-topbar-muted 2xl:pr-2.5">
        <Avatar className="size-7 rounded-lg">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="rounded-lg bg-brand-cold text-[11px] font-semibold text-white">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate text-[13px] font-medium 2xl:block">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserRound /> {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t("appearance")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun /> {t("light")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon /> {t("dark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor /> {t("system")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Languages className="size-3.5" /> {t("language")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(next) => startTransition(() => void setLanguage(next))}>
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>{localeNames[l]}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await clearStaffHint();
            await signOut();
            window.location.assign("/sign-in");
          }}
        >
          <LogOut /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
