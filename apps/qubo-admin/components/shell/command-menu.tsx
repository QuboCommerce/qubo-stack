"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ExternalLink, Monitor, Moon, Paintbrush, Plus, Sun } from "lucide-react";
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
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Jump anywhere in Qubo">
      <CommandInput placeholder={`Search ${site.name}…`} />
      <CommandList className="max-h-[min(28rem,70dvh)]">
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/online-store")}>
            <Paintbrush /> Customize theme
          </CommandItem>
          <CommandItem onSelect={() => go("/online-store/pages")}>
            <Plus /> Create page
          </CommandItem>
          {site.url && (
            <CommandItem onSelect={() => run(() => window.open(site.url!, "_blank"))}>
              <ExternalLink /> View live site
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {flatNavigation(site.capabilities).map((item) => (
            <CommandItem key={item.href} value={`${item.parent ?? ""} ${item.label}`} onSelect={() => go(item.href)}>
              <item.icon />
              {item.parent && <span className="text-muted-foreground">{item.parent} ›</span>}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {sites.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch site">
              {sites.map((s) => (
                <CommandItem key={s.slug} value={`site ${s.name}`} onSelect={() => run(() => router.push(`/${s.slug}`))}>
                  <SiteAvatar name={s.name} className="size-5 rounded text-[9px]" />
                  {s.name}
                  {s.slug === site.slug && <CommandShortcut>Current</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => run(() => setTheme("light"))}><Sun /> Light mode</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}><Moon /> Dark mode</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}><Monitor /> System appearance</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
