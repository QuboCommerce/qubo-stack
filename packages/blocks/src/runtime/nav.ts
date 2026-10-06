/**
 * Small enhancements on top of the SiteHeader markup, which already works
 * without JavaScript (native popover + details):
 * - the circle reveal grows from the menu button that opened it;
 * - a link in the menu closes it first, so it never sits above a page cover;
 * - open dropdowns close on an outside click or Escape;
 * - a menu restored from the back/forward cache comes back closed;
 * - a bar whose links do not fit collapses to the menu button instead of
 *   running under the actions (the CSS breakpoint cannot know the link count).
 */

type PopoverEl = HTMLElement & { hidePopover?: () => void };

const isOpen = (el: Element) => {
  try {
    return el.matches(":popover-open");
  } catch {
    return false;
  }
};

export function startNav(doc: Document): () => void {
  const win = doc.defaultView;
  if (!win) return () => {};
  const panels = Array.from(doc.querySelectorAll<PopoverEl>(".qb-site-menu-panel[popover]"));
  const offs: (() => void)[] = [];

  for (const panel of panels) {
    const kind = panel.dataset.menu;
    // Only full-width panels sit at the viewport origin, so viewport coordinates
    // are panel coordinates. Sheets keep their corner origin from CSS.
    const onBefore = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || (kind !== "fullscreen" && kind !== "drop")) return;
      const toggle = Array.from(doc.querySelectorAll<HTMLElement>(`[popovertarget="${panel.id}"]`)).find(
        (b) => !panel.contains(b) && b.getClientRects().length > 0,
      );
      if (!toggle) return;
      const r = toggle.getBoundingClientRect();
      panel.style.setProperty("--qb-nav-ox", `${Math.round(r.left + r.width / 2)}px`);
      panel.style.setProperty("--qb-nav-oy", `${Math.round(r.top + r.height / 2)}px`);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a && panel.contains(a) && isOpen(panel)) panel.hidePopover?.();
    };
    panel.addEventListener("beforetoggle", onBefore);
    panel.addEventListener("click", onClick);
    offs.push(() => {
      panel.removeEventListener("beforetoggle", onBefore);
      panel.removeEventListener("click", onClick);
    });
  }

  const headers = Array.from(doc.querySelectorAll<HTMLElement>('.qb-site-header[data-collapse="auto"]:not([data-pattern="sidebar"])'));
  if (headers.length && "ResizeObserver" in win) {
    const fit = (header: HTMLElement) => {
      const nav = header.querySelector<HTMLElement>(".qb-site-nav");
      if (!nav) return;
      const over = () => nav.getClientRects().length > 0 && nav.scrollWidth > nav.clientWidth + 1;
      // Stage one trades the search field for its icon; stage two collapses to the menu.
      header.removeAttribute("data-overflow");
      if (!over()) return;
      header.setAttribute("data-overflow", "compact");
      if (over()) header.setAttribute("data-overflow", "menu");
    };
    const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target as HTMLElement)));
    headers.forEach((h) => ro.observe(h));
    offs.push(() => ro.disconnect());
  }

  // Sticky headers publish their height so pinned sections (SteelReveal) can sit below them.
  const sticky = doc.querySelector<HTMLElement>('.qb-section[data-block="SiteHeader"]:has(.qb-site-header[data-sticky])');
  if (sticky && "ResizeObserver" in win) {
    const root = doc.documentElement;
    const measure = () => root.style.setProperty("--qb-header-h", `${Math.round(sticky.getBoundingClientRect().height)}px`);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sticky);
    offs.push(() => {
      ro.disconnect();
      root.style.removeProperty("--qb-header-h");
    });
  }

  const openDropdowns = () => Array.from(doc.querySelectorAll<HTMLDetailsElement>(".qb-site-dropdown[open]"));
  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node | null;
    for (const d of openDropdowns()) if (!target || !d.contains(target)) d.open = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    for (const d of openDropdowns()) {
      const hadFocus = d.contains(doc.activeElement);
      d.open = false;
      if (hadFocus) d.querySelector<HTMLElement>("summary")?.focus();
    }
  };
  const onShow = (e: PageTransitionEvent) => {
    if (!e.persisted) return;
    panels.forEach((p) => isOpen(p) && p.hidePopover?.());
    openDropdowns().forEach((d) => (d.open = false));
  };
  doc.addEventListener("click", onDocClick);
  doc.addEventListener("keydown", onKey);
  win.addEventListener("pageshow", onShow);
  offs.push(() => {
    doc.removeEventListener("click", onDocClick);
    doc.removeEventListener("keydown", onKey);
    win.removeEventListener("pageshow", onShow);
  });
  return () => offs.forEach((o) => o());
}
