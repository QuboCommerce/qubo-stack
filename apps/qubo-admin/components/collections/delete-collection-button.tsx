"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { deleteCollection } from "@/app/collection-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function Submit() {
  const t = useTranslations("collections.editor.delete");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />} {t("submit")}
    </Button>
  );
}

/** Lives outside the editor's form: a nested form would submit the editor instead. */
export function DeleteCollectionButton({ site, id, name }: { site: string; id: string; name: string }) {
  const t = useTranslations("collections.editor.delete");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={deleteCollection}>
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
