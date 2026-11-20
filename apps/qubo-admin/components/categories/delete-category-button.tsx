"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { deleteCategory } from "@/app/category-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function Submit() {
  const t = useTranslations("categories.delete");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />} {t("submit")}
    </Button>
  );
}

export function DeleteCategoryButton({
  site,
  id,
  name,
  childCount,
  productCount,
  parentName,
}: {
  site: string;
  id: string;
  name: string;
  childCount: number;
  productCount: number;
  parentName: string | null;
}) {
  const t = useTranslations("categories.delete");
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
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {childCount > 0 && (
            <li>{parentName ? t("childrenToParent", { count: childCount, parent: parentName }) : t("childrenToTop", { count: childCount })}</li>
          )}
          <li>
            {productCount > 0 ? t("products", { count: productCount }) : t("noProducts")}
          </li>
        </ul>
        <form action={deleteCategory}>
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">{t("cancel")}</Button>
            </DialogClose>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
