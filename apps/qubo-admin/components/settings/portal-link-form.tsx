"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkPortal } from "@/app/portal-actions";

export function PortalLinkForm({ site, siteName, defaultPortalUrl }: { site: string; siteName: string; defaultPortalUrl: string }) {
  const [state, action, pending] = useActionState(linkPortal, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="site" value={site} />
      <div className="grid gap-1.5">
        <Label htmlFor="portal-token">Registration token</Label>
        <Input id="portal-token" name="token" required autoComplete="off" placeholder="Paste the token from Portal → Instances → Add" className="font-mono" />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="portal-name">Instance name</Label>
          <Input id="portal-name" name="name" defaultValue={siteName} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="portal-url">Portal</Label>
          <Input id="portal-url" name="portalUrl" defaultValue={defaultPortalUrl} />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Linking…" : "Link instance"}
        </Button>
      </div>
    </form>
  );
}
