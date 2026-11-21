"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, RotateCw, Share, SquarePlus } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome fires beforeinstallprompt once, often before React mounts the menu: keep it at module level.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const standaloneQuery = "(display-mode: standalone)";
const isStandalone = () =>
  window.matchMedia(standaloneQuery).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Registers the service worker and catches the install prompt. Mounted once in the admin frame. */
export function AppRuntime() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallPrompt;
      emit();
    };
    const onInstalled = () => {
      deferred = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const [env, setEnv] = useState({ standalone: false, ios: false });
  useEffect(() => setEnv({ standalone: isStandalone(), ios: isIos() }), []);
  return { ...env, canPrompt };
}

/**
 * User menu entries: "Install app" where the browser can install (prompt on Chrome/Edge,
 * instructions on iOS), and "Reload" once installed, since standalone mode has no reload button.
 * The iOS help dialog lives outside the dropdown (see InstallHelp) so closing the menu keeps it.
 */
export function InstallMenuItems({ onHelp }: { onHelp: () => void }) {
  const t = useTranslations("install");
  const { standalone, ios, canPrompt } = useInstall();

  if (standalone) {
    return (
      <DropdownMenuItem onSelect={() => window.location.reload()}>
        <RotateCw /> {t("reload")}
      </DropdownMenuItem>
    );
  }
  if (!canPrompt && !ios) return null;
  return (
    <DropdownMenuItem
      onSelect={async () => {
        if (!deferred) return onHelp();
        const p = deferred;
        await p.prompt();
        await p.userChoice.catch(() => null);
        deferred = null;
        emit();
      }}
    >
      <Download /> {t("install")}
    </DropdownMenuItem>
  );
}

export function InstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("install");
  const step = "grid h-9 min-w-9 shrink-0 place-items-center rounded-xl bg-foreground/[0.06] px-1.5";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="px-6 sm:pl-0">
          <DialogTitle>{t("iosTitle")}</DialogTitle>
          <DialogDescription>{t("iosDescription")}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <span className={step}><Share className="size-[18px]" /></span>
            {t("iosStep1")}
          </li>
          <li className="flex items-center gap-3">
            <span className={step}><SquarePlus className="size-[18px]" /></span>
            {t("iosStep2")}
          </li>
          <li className="flex items-center gap-3">
            <span className={`${step} text-xs font-semibold`}>{t("iosAdd")}</span>
            {t("iosStep3")}
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
