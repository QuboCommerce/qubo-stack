/**
 * Canvas engine for the particle effects (snow, particles). Aurora and grain
 * are pure CSS. Colour, density, speed and size come from the CSS variables
 * the theme compiles onto `[data-effect]`, so a section scheme recolours the
 * effect with no extra wiring. Pauses off-screen and when the tab is hidden;
 * draws a single still frame under reduced motion.
 */

type Flake = { x: number; y: number; r: number; vx: number; vy: number; phase: number };

export type EffectHandle = { stop: () => void };

const num = (s: CSSStyleDeclaration, name: string, d: number) => {
  const v = Number.parseFloat(s.getPropertyValue(name));
  return Number.isFinite(v) ? v : d;
};

export function startEffect(el: HTMLElement, opts: { reduced?: boolean } = {}): EffectHandle {
  const kind = el.dataset.effectKind;
  if (kind !== "snow" && kind !== "particles") return { stop: () => undefined };
  const win = el.ownerDocument.defaultView!;
  const canvas = el.ownerDocument.createElement("canvas");
  canvas.className = "qb-effect-canvas";
  el.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop: () => canvas.remove() };

  let flakes: Flake[] = [];
  let w = 0;
  let h = 0;
  let color = "#fff";
  let alpha = 0.8;
  let speed = 1;
  let size = 1;
  let density = 30;
  let raf = 0;
  let visible = true;
  let last = 0;
  let lastRead = 0;

  const read = () => {
    const s = win.getComputedStyle(el);
    // The canvas styles the element itself (`color`), so relative colours resolve to an absolute value.
    color = win.getComputedStyle(canvas).color || color;
    alpha = num(s, "--qb-effect-alpha", alpha);
    speed = num(s, "--qb-effect-speed", speed);
    size = num(s, "--qb-effect-size", size);
    density = num(s, "--qb-effect-density", density);
  };

  const spawn = (anywhere: boolean): Flake => {
    const snow = kind === "snow";
    const r = (snow ? 1 + Math.random() * 2.6 : 0.8 + Math.random() * 1.8) * size;
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -r * 2,
      r,
      vx: snow ? (Math.random() - 0.5) * 12 : (Math.random() - 0.5) * 10,
      vy: snow ? 18 + r * 9 : (Math.random() - 0.5) * 10 - 4,
      phase: Math.random() * Math.PI * 2,
    };
  };

  const resize = () => {
    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    w = el.clientWidth;
    h = el.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    read();
    const target = Math.min(600, Math.round(((w * h) / 100_000) * density));
    if (flakes.length > target) flakes.length = target;
    while (flakes.length < target) flakes.push(spawn(true));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    for (const f of flakes) {
      ctx.globalAlpha = kind === "particles" ? alpha * (0.5 + 0.5 * Math.sin(f.phase)) : alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const step = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    if (now - lastRead > 1000) {
      lastRead = now;
      read();
    }
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i]!;
      f.phase += dt * speed * 1.4;
      f.x += (f.vx + Math.sin(f.phase) * 8) * dt * speed;
      f.y += f.vy * dt * speed;
      if (f.y > h + 8 || f.y < -40 || f.x < -20 || f.x > w + 20) flakes[i] = kind === "snow" ? spawn(false) : spawn(true);
    }
    draw();
    raf = visible ? win.requestAnimationFrame(step) : 0;
  };

  const run = () => {
    if (opts.reduced || raf || !visible || el.ownerDocument.hidden) return;
    last = 0;
    raf = win.requestAnimationFrame(step);
  };
  const pause = () => {
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
  };

  resize();
  draw();
  const ro = new ResizeObserver(() => {
    resize();
    draw();
  });
  ro.observe(el);
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible) run();
    else pause();
  });
  io.observe(el);
  const onVisibility = () => (el.ownerDocument.hidden ? pause() : run());
  el.ownerDocument.addEventListener("visibilitychange", onVisibility);
  run();

  return {
    stop: () => {
      pause();
      ro.disconnect();
      io.disconnect();
      el.ownerDocument.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    },
  };
}

/** Starts every `[data-effect]` under `root`; returns one stop for all. */
export function startEffects(root: ParentNode, opts: { reduced?: boolean } = {}): EffectHandle {
  const handles = Array.from(root.querySelectorAll<HTMLElement>("[data-effect-kind=snow], [data-effect-kind=particles]")).map((el) => startEffect(el, opts));
  return { stop: () => handles.forEach((h) => h.stop()) };
}

/** Whether a MM-DD window (wrapping the new year) contains `date`. */
export function inSchedule(schedule: { enabled: boolean; from: string; to: string }, date = new Date()): boolean {
  if (!schedule.enabled) return true;
  const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return schedule.from <= schedule.to ? md >= schedule.from && md <= schedule.to : md >= schedule.from || md <= schedule.to;
}
