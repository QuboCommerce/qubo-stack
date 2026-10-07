/**
 * Browser behaviour for the "chapters" section kit: the full-screen catalogue
 * menu, the hero carousel, the drifting partner fields, the steel parallax and
 * the scroll entrances. Framework free; every listener and timer is released by
 * the returned stop function. Modules talk through `qb-ch:*` document events.
 */

const MENU_EVENT = "qb-ch:menu";
const PARTNERS_EVENT = "qb-ch:partners";
const CAROUSEL_PAUSE = "qb-ch:carousel-pause";
const CAROUSEL_SYNC = "qb-ch:carousel-sync";
const MOBILE = "(max-width: 767px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

type Stop = () => void;

export function startChapters(doc: Document): Stop {
  const win = doc.defaultView;
  if (!win || !doc.querySelector('[data-kit="chapters"]')) return () => {};
  const ac = new AbortController();
  const stops: Stop[] = [() => ac.abort()];
  const env = { doc, win, signal: ac.signal, stops };
  startReveal(env);
  doc.querySelectorAll<HTMLElement>("[data-ch-masthead]").forEach((m) => startMenu(env, m));
  doc.querySelectorAll<HTMLElement>(".qb-ch-hero-carousel").forEach((c) => startCarousel(env, c));
  doc.querySelectorAll<HTMLElement>("[data-ch-partner-field]").forEach((f) => startPartnerField(env, f));
  doc.querySelectorAll<HTMLElement>("[data-ch-steel]").forEach((s) => startSteel(env, s));
  return () => stops.splice(0).forEach((s) => s());
}

type Env = { doc: Document; win: Window & typeof globalThis; signal: AbortSignal; stops: Stop[] };

const menuOf = (doc: Document) => doc.querySelector<HTMLElement>(".qb-ch-mega-menu");
const menuShown = (doc: Document) => {
  const menu = menuOf(doc);
  return Boolean(menu && !menu.hidden);
};

// ------------------------------------------------------------- reveal ---

function startReveal({ doc, win, stops }: Env) {
  const items = Array.from(doc.querySelectorAll<HTMLElement>("[data-ch-reveal]"));
  if (!items.length) return;
  if (typeof win.IntersectionObserver !== "function" || win.matchMedia(REDUCED).matches) {
    items.forEach((el) => el.classList.add("qb-ch-is-visible"));
    return;
  }
  const html = doc.documentElement;
  html.classList.add("qb-ch-motion-ready");
  const io = new win.IntersectionObserver(
    (entries, observer) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("qb-ch-is-visible");
        observer.unobserve(e.target);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
  );
  items.forEach((el) => io.observe(el));
  stops.push(() => {
    io.disconnect();
    html.classList.remove("qb-ch-motion-ready");
  });
}

// --------------------------------------------------------------- menu ---

function startMenu({ doc, win, signal, stops }: Env, root: HTMLElement) {
  const menu = root.querySelector<HTMLElement>(".qb-ch-mega-menu");
  if (!menu) return;
  const on = { signal };
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-ch-menu-toggle]"));
  const close = menu.querySelector<HTMLButtonElement>(".qb-ch-mega-menu__close");
  const tabs = Array.from(menu.querySelectorAll<HTMLButtonElement>(".qb-ch-mega-category-tab"));
  const panels = Array.from(menu.querySelectorAll<HTMLElement>(".qb-ch-mega-menu__category-content"));
  const groups = Array.from(menu.querySelectorAll<HTMLButtonElement>(".qb-ch-mega-mobile-group__button"));
  const video = menu.querySelector<HTMLVideoElement>(".qb-ch-mega-menu__video");
  const reduced = win.matchMedia(REDUCED);
  const mobile = win.matchMedia(MOBILE);
  const ownSection = root.closest(".qb-section");
  const background = () => [
    ...Array.from(doc.querySelectorAll<HTMLElement>(".qb-section")).filter((s) => s !== ownSection),
    ...Array.from(root.querySelectorAll<HTMLElement>(".qb-ch-utility-bar, .qb-ch-site-header__inner, .qb-ch-skip-link")),
  ];
  let lastTrigger: HTMLElement | null = null;
  let closeTimer = 0;
  let selected = Math.max(0, tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"));

  const applyMode = (open: boolean) => {
    doc.body.classList.toggle("qb-ch-menu-open", open);
    background().forEach((n) => (n.inert = open));
  };

  const refreshHeights = () => {
    groups.forEach((b) => {
      if (b.getAttribute("aria-expanded") !== "true") return;
      const panel = b.nextElementSibling as HTMLElement | null;
      const inner = panel?.firstElementChild as HTMLElement | null;
      if (panel && inner) panel.style.maxHeight = `${Math.ceil(inner.scrollHeight)}px`;
    });
  };

  const setOpen = (open: boolean, trigger: HTMLElement | null = null, returnFocus = true) => {
    win.clearTimeout(closeTimer);
    if (open) {
      menu.hidden = false;
      menu.inert = false;
      menu.setAttribute("aria-hidden", "false");
      win.requestAnimationFrame(() =>
        win.requestAnimationFrame(() => {
          if (menu.getAttribute("aria-hidden") === "false") menu.classList.add("qb-ch-is-open");
        }),
      );
    } else {
      menu.classList.remove("qb-ch-is-open");
      menu.inert = true;
      menu.setAttribute("aria-hidden", "true");
      closeTimer = win.setTimeout(
        () => {
          if (menu.getAttribute("aria-hidden") !== "true") return;
          menu.hidden = true;
          doc.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: { open: false, phase: "settled" } }));
          doc.dispatchEvent(new Event(CAROUSEL_SYNC));
        },
        reduced.matches ? 20 : 540,
      );
    }
    triggers.forEach((b) => b.setAttribute("aria-expanded", String(open)));
    applyMode(open);
    doc.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: { open } }));
    if (open) {
      lastTrigger = trigger ?? (doc.activeElement as HTMLElement | null);
      doc.dispatchEvent(new Event(CAROUSEL_PAUSE));
      if (!reduced.matches) video?.play()?.catch(() => {});
      win.setTimeout(() => {
        if (menu.getAttribute("aria-hidden") !== "false") return;
        refreshHeights();
        close?.focus({ preventScroll: true });
      }, 45);
    } else {
      video?.pause();
      if (returnFocus) (lastTrigger ?? triggers[0])?.focus({ preventScroll: true });
      doc.dispatchEvent(new Event(CAROUSEL_SYNC));
    }
  };
  const isOpen = () => menu.getAttribute("aria-hidden") === "false";

  triggers.forEach((b) => b.addEventListener("click", () => setOpen(b.getAttribute("aria-expanded") !== "true", b), on));
  close?.addEventListener("click", () => setOpen(false), on);

  menu.addEventListener(
    "click",
    (e) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>("a");
      if (!link) return;
      const internal = link.origin === win.location.origin && link.pathname === win.location.pathname && link.hash;
      setOpen(false, null, !internal);
      if (internal) {
        const target = doc.getElementById(decodeURIComponent(link.hash.slice(1)));
        target?.setAttribute("tabindex", "-1");
        win.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
      }
    },
    on,
  );

  // Category tabs: every panel is rendered on the server; selection shows one.
  const select = (index: number, animate = true) => {
    if (!tabs.length) return;
    if (animate && index === selected) return;
    selected = Math.max(0, Math.min(index, tabs.length - 1));
    tabs.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === selected));
      t.tabIndex = i === selected ? 0 : -1;
    });
    panels.forEach((p, i) => {
      p.hidden = i !== selected;
      if (i === selected && animate) {
        p.classList.remove("qb-ch-is-changing");
        void p.offsetWidth;
        p.classList.add("qb-ch-is-changing");
      }
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("pointerenter", () => select(i), on);
    tab.addEventListener("focus", () => select(i), on);
    tab.addEventListener("click", () => select(i), on);
    tab.addEventListener(
      "keydown",
      (e) => {
        let next = i;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[next]?.focus();
        select(next);
      },
      on,
    );
  });
  select(selected, false);

  // Phone accordion: one family open at a time.
  groups.forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const willOpen = button.getAttribute("aria-expanded") !== "true";
        groups.forEach((other) => {
          const p = other.nextElementSibling as HTMLElement | null;
          other.setAttribute("aria-expanded", "false");
          if (p) {
            p.style.maxHeight = "0px";
            p.setAttribute("aria-hidden", "true");
            p.inert = true;
          }
        });
        const panel = button.nextElementSibling as HTMLElement | null;
        const inner = panel?.firstElementChild as HTMLElement | null;
        button.setAttribute("aria-expanded", String(willOpen));
        if (!panel) return;
        panel.setAttribute("aria-hidden", String(!willOpen));
        panel.inert = !willOpen;
        panel.style.maxHeight = willOpen ? `${inner?.scrollHeight ?? 0}px` : "0px";
      },
      on,
    );
  });
  if (typeof win.ResizeObserver === "function") {
    const ro = new win.ResizeObserver(refreshHeights);
    groups.forEach((b) => {
      const inner = b.nextElementSibling?.firstElementChild;
      if (inner) ro.observe(inner);
    });
    stops.push(() => ro.disconnect());
  }

  mobile.addEventListener(
    "change",
    () => {
      const open = isOpen();
      applyMode(open);
      if (!open) return;
      lastTrigger = triggers.find((b) => b.getClientRects().length) ?? lastTrigger;
      win.requestAnimationFrame(() => {
        refreshHeights();
        const dest = mobile.matches ? close : tabs[selected];
        (dest ?? close)?.focus({ preventScroll: true });
      });
    },
    on,
  );
  doc.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as Node;
      if (menu.classList.contains("qb-ch-is-open") && !menu.contains(t) && !triggers.some((b) => b.contains(t))) setOpen(false);
    },
    on,
  );
  doc.addEventListener(
    "visibilitychange",
    () => {
      if (doc.hidden) video?.pause();
      else if (menu.classList.contains("qb-ch-is-open") && !reduced.matches) video?.play()?.catch(() => {});
    },
    on,
  );
  doc.addEventListener(
    "keydown",
    (e) => {
      if (menu.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(menu.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")).filter(
        (n) => n.getClientRects().length && !n.closest("[inert]"),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = doc.activeElement;
      if (!menu.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    on,
  );
  reduced.addEventListener(
    "change",
    (e) => {
      if (e.matches) video?.pause();
      else if (!menu.hidden) video?.play()?.catch(() => {});
    },
    on,
  );

  startMenuPartners({ doc, win, signal, stops }, menu);

  stops.push(() => {
    win.clearTimeout(closeTimer);
    if (isOpen()) applyMode(false);
  });
}

/** Phones fold the partner field away behind a toggle; wider screens always show it. */
function startMenuPartners({ doc, win, signal }: Env, menu: HTMLElement) {
  const trigger = menu.querySelector<HTMLButtonElement>(".qb-ch-mega-menu__partners-toggle");
  const region = menu.querySelector<HTMLElement>(".qb-ch-mega-menu__reserve");
  const label = menu.querySelector<HTMLElement>(".qb-ch-mega-menu__partners-label--desktop");
  if (!trigger || !region) return;
  const mobile = win.matchMedia(MOBILE);
  const showLabel = trigger.dataset.showLabel ?? "";
  const hideLabel = trigger.dataset.hideLabel ?? "";
  const set = (requested: boolean) => {
    const expanded = mobile.matches ? requested : true;
    menu.classList.toggle("qb-ch-partners-expanded", expanded);
    menu.dataset.partnersExpanded = String(expanded);
    trigger.hidden = !mobile.matches;
    if (label) label.hidden = mobile.matches;
    trigger.setAttribute("aria-expanded", String(expanded));
    const aria = expanded ? hideLabel : showLabel;
    if (aria) trigger.setAttribute("aria-label", aria);
    region.setAttribute("aria-hidden", String(!expanded));
    region.inert = !expanded;
    doc.dispatchEvent(new CustomEvent(PARTNERS_EVENT, { detail: { expanded } }));
  };
  trigger.addEventListener("click", () => mobile.matches && set(trigger.getAttribute("aria-expanded") !== "true"), { signal });
  mobile.addEventListener("change", () => set(!mobile.matches), { signal });
  doc.addEventListener(
    MENU_EVENT,
    (e) => {
      const d = (e as CustomEvent<{ open: boolean; phase?: string }>).detail;
      if (d?.open && d.phase !== "settled") set(!mobile.matches);
    },
    { signal },
  );
  set(!mobile.matches);
}

// ----------------------------------------------------------- carousel ---

/** Photographs run on a clock; a film plays to its end, then the clock resumes. */
function startCarousel({ doc, win, signal, stops }: Env, carousel: HTMLElement) {
  const FRAME_MS = Number(carousel.dataset.frameMs) || 6800;
  const BACK_EXTRA_MS = 3000;
  const slides = Array.from(carousel.querySelectorAll<HTMLElement>(".qb-ch-hero-slide"));
  const dots = Array.from(carousel.querySelectorAll<HTMLButtonElement>(".qb-ch-hero-dot"));
  if (!slides.length) return;
  const on = { signal };
  const preference = win.matchMedia(REDUCED);
  const of = (template: string, n: number) => template.replace("{n}", String(n + 1)).replace("{total}", String(slides.length));
  const slideLabel = carousel.dataset.slideLabel ?? "{n} / {total}";
  const statusEl = carousel.querySelector<HTMLElement>("[data-ch-carousel-status]");
  const title = carousel.querySelector<HTMLElement>("[data-ch-carousel-title]");
  const counter = carousel.querySelector<HTMLElement>("[data-ch-carousel-counter]");
  let index = 0;
  let remaining = FRAME_MS;
  let deadline = 0;
  let timeout = 0;
  let progressFrame = 0;
  let extra = 0;
  let ended = false;
  let failed = false;
  let inView = true;
  let away = false;
  let selection = 0;
  let playPending = false;

  const activeVideo = () => slides[index]?.querySelector("video") ?? null;
  const allowed = () => inView && !away && !doc.hidden && !preference.matches && !menuShown(doc);
  const caption = () => slides[index]?.dataset.caption ?? "";

  const fillProgress = (value: number) => {
    const p = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    dots[index]?.style.setProperty("--qb-ch-video-progress", p.toFixed(4));
  };
  const stopClock = () => {
    if (deadline) remaining = Math.max(0, deadline - performance.now());
    deadline = 0;
    win.clearTimeout(timeout);
    timeout = 0;
  };
  const pauseCycle = () => {
    stopClock();
    win.cancelAnimationFrame(progressFrame);
    progressFrame = 0;
    activeVideo()?.pause();
  };
  const clock = () => {
    if (timeout || !allowed()) return;
    deadline = performance.now() + remaining;
    timeout = win.setTimeout(() => {
      timeout = 0;
      deadline = 0;
      if (allowed()) selectSlide(index + 1);
      else {
        remaining = 0;
        pauseCycle();
      }
    }, remaining);
  };
  const trackFilm = () => {
    progressFrame = 0;
    const video = activeVideo();
    if (!video || !allowed() || ended || failed) return;
    fillProgress(video.duration > 0 ? video.currentTime / video.duration : 0);
    progressFrame = win.requestAnimationFrame(trackFilm);
  };
  const syncCycle = () => {
    if (!allowed()) return pauseCycle();
    const video = activeVideo();
    if (!video || failed || ended) return clock();
    if (!progressFrame) progressFrame = win.requestAnimationFrame(trackFilm);
    if (video.paused && !playPending) {
      playPending = true;
      const ticket = selection;
      Promise.resolve(video.play())
        .then(() => {
          if (ticket !== selection || !allowed()) video.pause();
        })
        .catch((error: { name?: string }) => {
          if (ticket !== selection || !allowed() || error?.name === "AbortError") return;
          failed = true;
          remaining = FRAME_MS + extra;
          win.cancelAnimationFrame(progressFrame);
          progressFrame = 0;
          clock();
        })
        .finally(() => {
          if (ticket === selection) playPending = false;
        });
    }
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  function selectSlide(next: number, manual = false, previous = false) {
    pauseCycle();
    selection += 1;
    playPending = false;
    index = (next + slides.length) % slides.length;
    extra = previous ? BACK_EXTRA_MS : 0;
    ended = false;
    failed = false;
    const video = activeVideo();
    remaining = video ? extra : FRAME_MS + extra;
    if (video) {
      try {
        video.currentTime = 0;
      } catch {
        /* metadata may still be loading */
      }
    }
    slides.forEach((s, i) => {
      const active = i === index;
      s.classList.toggle("qb-ch-is-active", active);
      s.setAttribute("aria-hidden", String(!active));
      s.setAttribute("aria-label", of(slideLabel, i));
      if (!active) s.querySelector("video")?.pause();
    });
    dots.forEach((d, i) => {
      d.classList.toggle("qb-ch-is-active", i === index);
      d.setAttribute("aria-pressed", String(i === index));
      d.style.setProperty("--qb-ch-video-progress", "0");
    });
    if (title) title.textContent = caption();
    if (counter) counter.innerHTML = `${pad(index + 1)} <i>/</i> ${pad(slides.length)}`;
    if (manual && statusEl) statusEl.textContent = `${of(slideLabel, index)} : ${caption()}`;
    syncCycle();
  }

  slides.forEach((slide, i) => {
    const video = slide.querySelector("video");
    if (!video) return;
    video.loop = false;
    video.addEventListener(
      "ended",
      () => {
        if (i !== index || ended) return;
        ended = true;
        win.cancelAnimationFrame(progressFrame);
        progressFrame = 0;
        fillProgress(1);
        remaining = extra;
        extra = 0;
        syncCycle();
      },
      on,
    );
    video.addEventListener("loadedmetadata", () => i === index && syncCycle(), on);
    video.addEventListener(
      "error",
      () => {
        if (i !== index) return;
        failed = true;
        remaining = FRAME_MS + extra;
        syncCycle();
      },
      on,
    );
  });
  carousel.querySelector("[data-ch-carousel-prev]")?.addEventListener("click", () => selectSlide(index - 1, true, true), on);
  carousel.querySelector("[data-ch-carousel-next]")?.addEventListener("click", () => selectSlide(index + 1, true), on);
  dots.forEach((d, i) => d.addEventListener("click", () => selectSlide(i, true), on));
  if (typeof win.IntersectionObserver === "function") {
    const io = new win.IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        syncCycle();
      },
      { threshold: 0.1 },
    );
    io.observe(carousel);
    stops.push(() => io.disconnect());
  }
  doc.addEventListener("visibilitychange", syncCycle, on);
  doc.addEventListener(MENU_EVENT, syncCycle, on);
  doc.addEventListener(CAROUSEL_PAUSE, pauseCycle, on);
  doc.addEventListener(CAROUSEL_SYNC, syncCycle, on);
  preference.addEventListener("change", syncCycle, on);
  win.addEventListener("pagehide", () => ((away = true), pauseCycle()), on);
  win.addEventListener("pageshow", () => ((away = false), syncCycle()), on);
  stops.push(pauseCycle);
  selectSlide(0);
}

// ------------------------------------------------------ partner field ---

/** A diagonal drift of logos; the native animation clock keeps its phase when the speed eases. */
function startPartnerField({ doc, win, signal, stops }: Env, field: HTMLElement) {
  const track = field.querySelector<HTMLElement>(".qb-ch-partner-track");
  if (!track || typeof track.animate !== "function") return;
  const on = { signal };
  const inMenu = Boolean(field.closest(".qb-ch-mega-menu"));
  const columns = Number(field.dataset.chPartnerColumns) || 8;
  const rows = Number(field.dataset.chPartnerRows) || 4;
  const duration = Number(field.dataset.chPartnerDuration) || (inMenu ? 56000 : 84000);
  const slowerRate = Math.max(0.15, Math.min(1, Number(field.dataset.chPartnerHoverRate) || 0.32));
  const reduced = win.matchMedia(REDUCED);
  let animation: Animation | null = null;
  let visible = false;
  let running = false;
  let hovered = false;
  let away = false;
  let rate = 1;
  let rateFrame = 0;
  let lastRateTime = 0;
  let periodX = 0;
  let periodY = 0;

  const belongsToView = () => {
    const menu = menuOf(doc);
    const shown = Boolean(menu && !menu.hidden);
    const open = shown && menu?.getAttribute("aria-hidden") === "false";
    return inMenu ? open : !shown;
  };
  const canRun = () =>
    visible && !field.closest('[inert], [aria-hidden="true"]') && belongsToView() && !doc.hidden && !away && !reduced.matches;
  const applyRate = (value: number) => {
    rate = value;
    if (!animation) return;
    if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
    else animation.playbackRate = rate;
  };
  const interpolate = (time: number) => {
    rateFrame = 0;
    if (!running) return;
    const target = hovered ? slowerRate : 1;
    const elapsed = Math.min(64, lastRateTime ? time - lastRateTime : 16);
    lastRateTime = time;
    const eased = rate + (target - rate) * (1 - Math.exp(-elapsed / 360));
    applyRate(Math.abs(target - eased) < 0.002 ? target : eased);
    if (rate !== target) rateFrame = win.requestAnimationFrame(interpolate);
  };
  const easeRate = () => {
    if (!running || rateFrame) return;
    lastRateTime = 0;
    rateFrame = win.requestAnimationFrame(interpolate);
  };
  const ensureClock = () => {
    const cells = track.children;
    const first = cells[0]?.getBoundingClientRect();
    const horizontal = cells[columns]?.getBoundingClientRect();
    const vertical = cells[rows * columns * 2]?.getBoundingClientRect();
    if (!first || !horizontal || !vertical) return false;
    const x = horizontal.left - first.left;
    const y = vertical.top - first.top;
    if (x <= 0 || y <= 0) return false;
    if (animation && Math.abs(x - periodX) < 0.1 && Math.abs(y - periodY) < 0.1) return true;
    const phase = animation ? ((Number(animation.currentTime) || 0) % duration) / duration : 0;
    animation?.cancel();
    periodX = x;
    periodY = y;
    animation = track.animate(
      [{ transform: "translate3d(-24px,-24px,0)" }, { transform: `translate3d(${-24 - x}px,${-24 - y}px,0)` }],
      { duration, iterations: Infinity, easing: "linear" },
    );
    animation.pause();
    animation.currentTime = phase * duration;
    applyRate(rate);
    return true;
  };
  const sync = () => {
    running = canRun() && ensureClock();
    field.classList.toggle("qb-ch-is-running", running);
    if (running) {
      animation?.play();
      easeRate();
    } else {
      animation?.pause();
      win.cancelAnimationFrame(rateFrame);
      rateFrame = 0;
      lastRateTime = 0;
    }
  };
  field.addEventListener(
    "pointerenter",
    (e) => {
      if (e.pointerType === "touch") return;
      hovered = true;
      easeRate();
    },
    on,
  );
  field.addEventListener("pointerleave", () => ((hovered = false), easeRate()), on);
  if (typeof win.IntersectionObserver === "function") {
    const io = new win.IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.02 },
    );
    io.observe(field);
    stops.push(() => io.disconnect());
  } else visible = true;
  if (typeof win.ResizeObserver === "function") {
    const ro = new win.ResizeObserver(sync);
    ro.observe(field);
    stops.push(() => ro.disconnect());
  }
  doc.addEventListener("visibilitychange", sync, on);
  doc.addEventListener(MENU_EVENT, sync, on);
  doc.addEventListener(PARTNERS_EVENT, sync, on);
  reduced.addEventListener("change", sync, on);
  win.addEventListener("pagehide", () => ((away = true), sync()), on);
  win.addEventListener("pageshow", () => ((away = false), sync()), on);
  stops.push(() => {
    win.cancelAnimationFrame(rateFrame);
    animation?.cancel();
  });
  sync();
}

// -------------------------------------------------------------- steel ---

/** The brushed steel band follows a fine pointer by a few pixels. */
function startSteel({ win, signal, stops }: Env, surface: HTMLElement) {
  const backdrop = surface.querySelector<HTMLElement>(".qb-ch-material-field__backdrop");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = win.matchMedia(REDUCED);
  if (!backdrop) return;
  let target = { x: 0.5, y: 0.5 };
  const pointer = { x: 0.5, y: 0.5 };
  let frame = 0;
  const ease = () => {
    frame = 0;
    if (reduced.matches || !fine.matches) return;
    pointer.x += (target.x - pointer.x) * 0.085;
    pointer.y += (target.y - pointer.y) * 0.085;
    backdrop.style.setProperty("--qb-ch-steel-x", `${((pointer.x - 0.5) * 10).toFixed(3)}px`);
    backdrop.style.setProperty("--qb-ch-steel-y", `${((pointer.y - 0.5) * 7).toFixed(3)}px`);
    if (Math.abs(target.x - pointer.x) + Math.abs(target.y - pointer.y) > 0.001) frame = win.requestAnimationFrame(ease);
  };
  surface.addEventListener(
    "pointermove",
    (e) => {
      if (!fine.matches || e.pointerType === "touch" || reduced.matches) return;
      const r = surface.getBoundingClientRect();
      target = {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      };
      if (!frame) frame = win.requestAnimationFrame(ease);
    },
    { passive: true, signal },
  );
  surface.addEventListener(
    "pointerleave",
    () => {
      target = { x: 0.5, y: 0.5 };
      if (!frame) frame = win.requestAnimationFrame(ease);
    },
    { signal },
  );
  stops.push(() => win.cancelAnimationFrame(frame));
}
