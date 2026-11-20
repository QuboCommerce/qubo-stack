"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { deletePageAction } from "@/app/page-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function Submit() {
  const t = useTranslations("onlineStore.pages.delete");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />} {t("confirm")}
    </Button>
  );
}

export function DeletePageButton({ site, id, title, slug, published }: { site: string; id: string; title: string; slug: string; published: boolean }) {
  const t = useTranslations("onlineStore.pages.delete");
  const tc = useTranslations("common");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={t("label", { title })}>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { title })}</DialogTitle>
          <DialogDescription>
            {published ? t("descriptionLive", { slug }) : t("description", { slug })}
          </DialogDescription>
        </DialogHeader>
        <form action={deletePageAction}>
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" size="sm">{tc("cancel")}</Button></DialogClose>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
