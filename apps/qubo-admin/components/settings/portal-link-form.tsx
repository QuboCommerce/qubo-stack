"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkPortal } from "@/app/portal-actions";

export function PortalLinkForm({ site, siteName, defaultPortalUrl }: { site: string; siteName: string; defaultPortalUrl: string }) {
  const t = useTranslations("portal.form");
  const [state, action, pending] = useActionState(linkPortal, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="site" value={site} />
      <div className="grid gap-1.5">
        <Label htmlFor="portal-token">{t("token")}</Label>
        <Input id="portal-token" name="token" required autoComplete="off" placeholder={t("tokenPlaceholder")} className="font-mono" />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="portal-name">{t("name")}</Label>
          <Input id="portal-name" name="name" defaultValue={siteName} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="portal-url">{t("portal")}</Label>
          <Input id="portal-url" name="portalUrl" defaultValue={defaultPortalUrl} />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("linking") : t("link")}
        </Button>
      </div>
    </form>
  );
}
