"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { usePeers, type Peer } from "@qubo/realtime/client";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@qubo/shared/utils";

/** Stable per-user colour, so the same person has the same ring everywhere. */
export function peerColor(userId: string) {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 45%)`;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** "Products › Edit" style hint of where a peer is, from their route. */
function where(p: Peer) {
  const parts = p.route.split("/").filter(Boolean).slice(1);
  if (!parts.length) return "Home";
  if (parts[0] === "studio") return "Studio";
  const label = parts[0]!.replace(/-/g, " ");
  return `${label[0]!.toUpperCase()}${label.slice(1)}${parts.length > 1 ? (parts[1] === "new" ? " › New" : " › Editing") : ""}`;
}

function PeerAvatar({ peer, size = "sm", className }: { peer: Peer; size?: "sm" | "default"; className?: string }) {
  return (
    <Avatar
      size={size}
      title={`${peer.name} · ${where(peer)}${peer.focused ? "" : " (away)"}`}
      className={cn("ring-2", !peer.focused && "opacity-50", className)}
      style={{ ["--tw-ring-color" as string]: peerColor(peer.userId) }}
    >
      {peer.image && <AvatarImage src={peer.image} alt="" />}
      <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: peerColor(peer.userId) }}>
        {initials(peer.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Top bar: who else is in this site right now. */
export function PresenceStack({ max = 4, className }: { max?: number; className?: string }) {
  const peers = usePeers();
  if (!peers.length) return null;
  return (
    <AvatarGroup className={cn("mr-1 *:data-[slot=avatar]:ring-topbar", className)} aria-label={`${peers.length} other ${peers.length === 1 ? "person" : "people"} here`}>
      {peers.slice(0, max).map((p) => <PeerAvatar key={p.userId} peer={p} />)}
      {peers.length > max && <AvatarGroupCount className="size-6 text-[10px] ring-topbar">+{peers.length - max}</AvatarGroupCount>}
    </AvatarGroup>
  );
}

/** Index rows: avatars of people who have `path` (or a sub-page of it) open. */
export function RowPresence({ path, className }: { path: string; className?: string }) {
  const peers = usePeers((e) => e.route === path || e.route.startsWith(`${path}/`));
  if (!peers.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle text-[11px] font-medium text-muted-foreground", className)}>
      <AvatarGroup className="*:data-[slot=avatar]:size-5">
        {peers.slice(0, 3).map((p) => <PeerAvatar key={p.userId} peer={p} />)}
      </AvatarGroup>
      <span className="hidden @min-[48rem]:inline">{peers.length === 1 ? `${peers[0]!.name.split(" ")[0]} is editing` : `${peers.length} editing`}</span>
    </span>
  );
}

type Box = { top: number; left: number; width: number; height: number };
const sameBox = (a: Box | undefined, b: Box) => a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/** Re-measures `find(peer)` every frame while there are peers (cheap: a handful of rects). */
function useBoxes(peers: Peer[], find: (p: Peer) => Element | null) {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const key = peers.map((p) => `${p.clientId}:${p.fieldPath}:${p.blockId}`).join("|");
  useEffect(() => {
    if (!peers.length) return setBoxes({});
    let raf = 0;
    const tick = () => {
      const next: Record<string, Box> = {};
      for (const p of peers) {
        const r = find(p)?.getBoundingClientRect();
        if (r && r.width + r.height > 0) next[p.clientId] = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
      setBoxes((prev) => (Object.keys(prev).length === Object.keys(next).length && Object.entries(next).every(([k, b]) => sameBox(prev[k], b)) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return boxes;
}

const fieldEl = (name: string) => {
  const el = document.querySelector(`form [data-presence-field="${CSS.escape(name)}"], form [name="${CSS.escape(name)}"]`);
  return el instanceof HTMLInputElement && el.type === "hidden" ? null : el;
};

/** Forms: outlines the field another person is in, with their avatar. Mounted once per page tree. */
export function FieldPresenceOverlay() {
  const pathname = usePathname();
  const peers = usePeers((e) => e.route === pathname && !!e.fieldPath);
  const boxes = useBoxes(peers, (p) => fieldEl(p.fieldPath!));
  if (!peers.length || typeof document === "undefined") return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      {peers.map((p) => {
        const b = boxes[p.clientId];
        if (!b) return null;
        const color = peerColor(p.userId);
        return (
          <div key={p.clientId} className="absolute rounded-md" style={{ top: b.top - 3, left: b.left - 3, width: b.width + 6, height: b.height + 6, boxShadow: `0 0 0 2px ${color}` }}>
            <span className="absolute -top-2.5 right-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 text-white shadow-sm" style={{ background: color }}>
              {p.name.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/**
 * Studio canvas: outlines blocks other people have selected in this document.
 * Rendered inside Puck's preview iframe with inline styles (the storefront CSS
 * lives there, not the admin's).
 */
export function BlockPresenceOverlay({ documentId }: { documentId: string }) {
  const peers = usePeers((e) => e.documentId === documentId && !!e.blockId);
  const frame = () => (typeof document === "undefined" ? null : (document.getElementById("preview-frame") as HTMLIFrameElement | null)?.contentDocument ?? null);
  const boxes = useBoxes(peers, (p) => frame()?.querySelector(`[data-puck-component="${CSS.escape(p.blockId!)}"]`) ?? null);
  const body = frame()?.body;
  if (!peers.length || !body) return null;
  return createPortal(
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147483000 }}>
      {peers.map((p) => {
        const b = boxes[p.clientId];
        if (!b) return null;
        const color = peerColor(p.userId);
        return (
          <div key={p.clientId} style={{ position: "absolute", top: b.top, left: b.left, width: b.width, height: b.height, outline: `2px dashed ${color}`, outlineOffset: -2 }}>
            <span style={{ position: "absolute", top: 4, right: 4, background: color, color: "#fff", font: "600 11px/18px system-ui, sans-serif", padding: "0 8px", borderRadius: 999, boxShadow: "0 1px 3px rgb(0 0 0 / .25)" }}>
              {p.name.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>,
    body,
  );
}

/** Studio top bar: who else has this document open. */
export function DocumentPresence({ documentId }: { documentId: string }) {
  const peers = usePeers((e) => e.documentId === documentId);
  if (!peers.length) return null;
  return (
    <AvatarGroup className="mr-1">
      {peers.slice(0, 3).map((p) => <PeerAvatar key={p.userId} peer={p} />)}
      {peers.length > 3 && <AvatarGroupCount className="size-6 text-[10px]">+{peers.length - 3}</AvatarGroupCount>}
    </AvatarGroup>
  );
}
