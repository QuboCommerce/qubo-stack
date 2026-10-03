"use client";

import { useFormStatus } from "react-dom";
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
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />} Delete category
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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>No product is deleted.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {childCount > 0 && (
            <li>
              Its {childCount} subcategor{childCount > 1 ? "ies move" : "y moves"} up to {parentName ? `“${parentName}”` : "the top level"}.
            </li>
          )}
          <li>
            {productCount > 0
              ? `${productCount} product${productCount > 1 ? "s lose" : " loses"} this category.`
              : "No products are in this category."}
          </li>
        </ul>
        <form action={deleteCategory}>
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
