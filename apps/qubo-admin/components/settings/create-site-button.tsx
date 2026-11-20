"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CreateSiteDialog } from "@/components/shell/create-dialogs";
import type { ShellOrg } from "@/components/shell/types";

export function CreateSiteButton({ orgs, defaultOrgId, disabled, title }: { orgs: ShellOrg[]; defaultOrgId: string; disabled: boolean; title?: string }) {
  const t = useTranslations("settings.sites");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" disabled={disabled} title={title} onClick={() => setOpen(true)}>
        <Plus /> {t("create")}
      </Button>
      <CreateSiteDialog open={open} onOpenChange={setOpen} orgs={orgs} defaultOrgId={defaultOrgId} />
    </>
  );
}
