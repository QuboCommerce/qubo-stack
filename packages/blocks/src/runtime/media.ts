/**
 * Ambient (looping, muted) videos only play while they are on screen, and
 * never when the visitor asked for reduced motion: they stay on the poster.
 * Player videos are left alone; the visitor controls those.
 */
export function startMedia(doc: Document): () => void {
  const win = doc.defaultView;
  const videos = Array.from(doc.querySelectorAll<HTMLVideoElement>("video[data-ambient]"));
  if (!win || !videos.length) return () => {};
  const motion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const visible = new Set<HTMLVideoElement>();

  const sync = (v: HTMLVideoElement) => {
    if (motion?.matches || !visible.has(v)) {
      if (!v.paused) v.pause();
    } else if (v.paused) {
      v.play()?.catch(() => {});
    }
  };
  const syncAll = () => videos.forEach(sync);

  for (const v of videos) {
    if (motion?.matches) {
      v.autoplay = false;
      v.pause();
    }
  }

  let io: IntersectionObserver | undefined;
  if (typeof win.IntersectionObserver === "function") {
    io = new win.IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) visible.add(v);
          else visible.delete(v);
          sync(v);
        }
      },
      { rootMargin: "120px 0px" },
    );
    videos.forEach((v) => io!.observe(v));
  } else {
    videos.forEach((v) => visible.add(v));
    syncAll();
  }

  motion?.addEventListener?.("change", syncAll);
  return () => {
    io?.disconnect();
    motion?.removeEventListener?.("change", syncAll);
  };
}
