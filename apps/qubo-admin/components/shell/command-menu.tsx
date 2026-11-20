"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ExternalLink, Monitor, Moon, Paintbrush, Plus, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { flatNavigation } from "@/lib/navigation";
import { SiteAvatar } from "./qubo-mark";
import type { ShellSite } from "./types";

export function CommandMenu({ open, onOpenChange, site, sites }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: ShellSite;
  sites: ShellSite[];
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const t = useTranslations("commandMenu");
  const nav = useTranslations("nav");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const go = (href: string) => run(() => router.push(`/${site.slug}${href}`));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("title")} description={t("description")}>
      <CommandInput placeholder={t("searchPlaceholder", { site: site.name })} />
      <CommandList className="max-h-[min(28rem,70dvh)]">
        <CommandEmpty>{t("empty")}</CommandEmpty>
        <CommandGroup heading={t("actions")}>
          <CommandItem onSelect={() => go("/online-store")}>
            <Paintbrush /> {t("customizeTheme")}
          </CommandItem>
          <CommandItem onSelect={() => go("/online-store/pages")}>
            <Plus /> {t("createPage")}
          </CommandItem>
          {site.url && (
            <CommandItem onSelect={() => run(() => window.open(site.url!, "_blank"))}>
              <ExternalLink /> {t("viewLiveSite")}
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("goTo")}>
          {flatNavigation(site.capabilities).map((item) => (
            <CommandItem key={item.href} value={`${item.parent ? nav(item.parent) : ""} ${nav(item.key)}`} onSelect={() => go(item.href)}>
              <item.icon />
              {item.parent && <span className="text-muted-foreground">{nav(item.parent)} ›</span>}
              {nav(item.key)}
            </CommandItem>
          ))}
        </CommandGroup>
        {sites.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("switchSite")}>
              {sites.map((s) => (
                <CommandItem key={s.slug} value={`site ${s.name}`} onSelect={() => run(() => router.push(`/${s.slug}`))}>
                  <SiteAvatar name={s.name} className="size-5 rounded text-[9px]" />
                  {s.name}
                  {s.slug === site.slug && <CommandShortcut>{t("current")}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading={t("appearance")}>
          <CommandItem onSelect={() => run(() => setTheme("light"))}><Sun /> {t("lightMode")}</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}><Moon /> {t("darkMode")}</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}><Monitor /> {t("systemAppearance")}</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
