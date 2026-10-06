"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { deletePageAction } from "@/app/page-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />} Delete page
    </Button>
  );
}

export function DeletePageButton({ site, id, title, slug, published }: { site: string; id: string; title: string; slug: string; published: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${title}`}>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>
            /{slug} and its sections are removed for good.
            {published ? " The page is live: visitors will get a 404 until you add a redirect." : ""}
          </DialogDescription>
        </DialogHeader>
        <form action={deletePageAction}>
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
