"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { toast } from "sonner";
import { usePeers } from "@qubo/realtime/client";
import { fieldEl, peerColor } from "@/components/presence";

// Survives the switch between the app and Studio layouts (separate LiveEvents).
const KEY = "qubo:spectate";

type Ctx = { target: string | null; watch: (userId: string | null) => void };
const SpectateContext = createContext<Ctx>({ target: null, watch: () => {} });
export const useSpectate = () => useContext(SpectateContext);

/** "Watch" another person: follow their page, field and Studio block until stopped. */
export function SpectateProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => setTarget(sessionStorage.getItem(KEY)), []);
  const watch = useCallback((userId: string | null) => {
    if (userId) sessionStorage.setItem(KEY, userId);
    else sessionStorage.removeItem(KEY);
    setTarget(userId);
  }, []);
  return (
    <SpectateContext.Provider value={{ target, watch }}>
      {children}
      {target && <Follow key={target} userId={target} stop={() => watch(null)} />}
    </SpectateContext.Provider>
  );
}

const GONE_AFTER = 8_000;

function Follow({ userId, stop }: { userId: string; stop: () => void }) {
  const peer = usePeers((e) => e.userId === userId)[0];
  const router = useRouter();
  const pathname = usePathname();
  const name = useRef("");
  if (peer) name.current = peer.name;
  const route = peer?.route;
  const pushed = useRef<string | null>(null);

  // Left the site.
  useEffect(() => {
    if (peer) return;
    const t = setTimeout(() => {
      if (name.current) toast(`${name.current.split(" ")[0]} left`, { duration: 2500 });
      stop();
    }, GONE_AFTER);
    return () => clearTimeout(t);
  }, [peer, stop]);

  // Follow their page.
  useEffect(() => {
    if (!route || route === pathname) return;
    pushed.current = route;
    router.push(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Navigating somewhere else yourself stops watching.
  const lastPath = useRef(pathname);
  useEffect(() => {
    const moved = lastPath.current !== pathname;
    lastPath.current = pathname;
    if (!moved || !route || pathname === route || pathname === pushed.current) return;
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Keep their field / block in view.
  const field = route === pathname ? peer?.fieldPath : undefined;
  const block = route === pathname ? peer?.blockId : undefined;
  useEffect(() => {
    if (!field) return;
    const t = setTimeout(() => fieldEl(field)?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    return () => clearTimeout(t);
  }, [field]);
  useEffect(() => {
    if (!block) return;
    const t = setTimeout(() => {
      const doc = (document.getElementById("preview-frame") as HTMLIFrameElement | null)?.contentDocument;
      doc?.querySelector(`[data-puck-component="${CSS.escape(block)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
    return () => clearTimeout(t);
  }, [block]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stop]);

  const first = (peer?.name ?? name.current).split(" ")[0] || "…";
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground py-1 pr-1 pl-3 text-[13px] text-background shadow-lg">
      <span className="size-2 rounded-full" style={{ background: peerColor(userId) }} />
      <Eye className="size-3.5 opacity-70" />
      <span>
        Watching {first}
        {!peer && " · waiting…"}
      </span>
      <button type="button" onClick={stop} className="inline-flex items-center gap-1 rounded-full bg-background/15 px-2.5 py-1 text-xs font-medium hover:bg-background/25">
        <X className="size-3" /> Stop
      </button>
    </div>
  );
}
