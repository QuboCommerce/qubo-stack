"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileText, ImagePlus, Loader2, MoreHorizontal, Paperclip, Pin, PinOff, X } from "lucide-react";
import type { MessageAttachment } from "@qubo/db/schema";
import { formatBytes } from "@qubo/storage";
import { cn } from "@qubo/shared/utils";
import { keepFileAction, saveFileToMediaAction } from "@/app/inbox-actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type FileState = Record<string, { source: "chat" | "email" | "form" | "staff"; expiresAt: string | null }>;

const fileUrl = (site: string, id: string, download = false) => `/api/inbox-files/${id}?site=${encodeURIComponent(site)}${download ? "&download=1" : ""}`;
const libraryTypes = /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf)/;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** Files on one message: thumbnails for images, chips for the rest, with keep / save-to-media actions. */
export function MessageFiles({ site, attachments, files }: { site: string; attachments: MessageAttachment[]; files: FileState }) {
  const [note, setNote] = useState<string | null>(null);
  const shown = attachments.filter((a) => a.id || a.url);
  if (!shown.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-start gap-1.5">
        {shown.map((a) =>
          a.id ? <FileItem key={a.id} site={site} a={a as MessageAttachment & { id: string }} state={files[a.id]} onNote={setNote} /> : (
            <a key={a.url} href={a.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs hover:bg-accent">
              <Paperclip className="size-3.5" /> {a.name}
            </a>
          ),
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function FileItem({ site, a, state, onNote }: { site: string; a: MessageAttachment & { id: string }; state: FileState[string] | undefined; onNote: (n: string) => void }) {
  const [pending, start] = useTransition();
  if (!state) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground" title="Chat files are removed after 30 days unless kept.">
        <Paperclip className="size-3.5" /> {a.name} · expired
      </span>
    );
  }
  const image = Boolean(a.type?.startsWith("image/")) && a.type !== "image/svg+xml";
  const expiring = state.source === "chat" && state.expiresAt;
  const act = (fn: () => Promise<{ ok: boolean; error?: string; name?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      onNote(res.ok ? done : (res.error ?? "Something went wrong."));
    });

  return (
    <div className={cn("group relative overflow-hidden rounded-lg border bg-background text-xs", pending && "opacity-60")}>
      <a href={fileUrl(site, a.id)} target="_blank" rel="noopener" className="block">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(site, a.id)} alt={a.name} loading="lazy" className="h-28 max-w-56 object-cover" />
        ) : (
          <span className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-8">
            <FileText className="size-3.5 shrink-0" />
            <span className="max-w-52 truncate">{a.name}</span>
            {a.size != null && <span className="text-muted-foreground">{formatBytes(a.size)}</span>}
          </span>
        )}
      </a>
      {(image || expiring) && (
        <p className={cn("flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground", image && "border-t")}>
          {image && <span className="max-w-40 truncate">{a.name}</span>}
          {expiring && <span className="ml-auto shrink-0 text-amber-700 dark:text-amber-400">{daysLeft(state.expiresAt!)}d left</span>}
          {state.source === "chat" && !state.expiresAt && <Pin className="ml-auto size-3 shrink-0" aria-label="Kept" />}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute right-1 top-1 grid size-6 place-items-center rounded-md bg-background/90 opacity-80 shadow-xs hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Actions for ${a.name}`}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-3.5" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={fileUrl(site, a.id, true)}>
              <Download /> Download
            </a>
          </DropdownMenuItem>
          {a.type && libraryTypes.test(a.type) && (
            <DropdownMenuItem onSelect={() => act(() => saveFileToMediaAction(site, a.id), `${a.name} was added to the media library.`)}>
              <ImagePlus /> Save to media library
            </DropdownMenuItem>
          )}
          {state.source === "chat" &&
            (state.expiresAt ? (
              <DropdownMenuItem onSelect={() => act(() => keepFileAction(site, a.id, true), `${a.name} will be kept.`)}>
                <Pin /> Keep (don&apos;t expire)
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => act(() => keepFileAction(site, a.id, false), `${a.name} expires 30 days after it was sent.`)}>
                <PinOff /> Let it expire
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type Draft = { id: string; name: string; size?: number };

/** Composer attachments: uploads as soon as they're picked, so sending stays a small server action. */
export function useReplyFiles(site: string, conversationId: string, max: number) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(list: File[]) {
    if (!list.length) return;
    if (drafts.length + list.length > max) return setError(`Up to ${max} files per reply.`);
    setError(null);
    setUploading((n) => n + list.length);
    const body = new FormData();
    body.set("site", site);
    body.set("conversation", conversationId);
    for (const f of list) body.append("files", f);
    const res = await fetch("/api/inbox-files", { method: "POST", body }).catch(() => null);
    setUploading((n) => n - list.length);
    const data = (await res?.json().catch(() => null)) as { attachments?: Draft[]; error?: string } | null;
    if (!res?.ok || !data?.attachments) return setError(data?.error ?? "Upload failed.");
    setDrafts((d) => [...d, ...data.attachments!]);
  }

  const picker = (
    <input
      ref={input}
      type="file"
      multiple
      hidden
      onChange={(e) => {
        const list = Array.from(e.currentTarget.files ?? []);
        e.currentTarget.value = "";
        void upload(list);
      }}
    />
  );

  const list =
    drafts.length || uploading ? (
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {drafts.map((d) => (
          <li key={d.id} className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pl-2.5 pr-1 text-xs">
            <input type="hidden" name="fileIds" value={d.id} />
            <Paperclip className="size-3" />
            <span className="max-w-48 truncate">{d.name}</span>
            {d.size != null && <span className="text-muted-foreground">{formatBytes(d.size)}</span>}
            <button type="button" className="grid size-5 place-items-center rounded-full hover:bg-accent" aria-label={`Remove ${d.name}`} onClick={() => setDrafts((all) => all.filter((x) => x.id !== d.id))}>
              <X className="size-3" />
            </button>
          </li>
        ))}
        {uploading > 0 && (
          <li className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Uploading {uploading}…
          </li>
        )}
      </ul>
    ) : null;

  return { drafts, uploading, error, picker, list, upload, open: () => input.current?.click(), reset: () => setDrafts([]) };
}
