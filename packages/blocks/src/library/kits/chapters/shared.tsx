import type { ReactNode } from "react";
import { f, linkTarget, resolveLink, resolveMedia, textOf, type BlockContext, type LinkValue, type MediaValue } from "../../../core";
import { IconGlyph } from "../../icons";

/** Every chapters block root carries this, so kit CSS and runtime find it. */
export const KIT = { "data-kit": "chapters" } as const;

export const isVideoSrc = (src: string) => /\.(mp4|webm|mov)(\?|$)/i.test(src);

/** Scroll entrance played by the kit runtime. */
export const reveal = (kind: "left" | "right" | "rise" | "scale" | "wipe", delay?: 1 | 2 | 3) => ({
  "data-ch-reveal": kind,
  ...(delay ? { "data-ch-reveal-delay": String(delay) } : {}),
});

/**
 * Heading markup typed in a plain text field: a new line breaks the line,
 * `*words*` sets the accent (italic cobalt), `[words]` keeps a phrase together.
 */
export function Marked({ value, phrase = "qb-ch-heading-phrase" }: { value: unknown; phrase?: string }) {
  const src = textOf(value);
  type Node = { tag: "root" | "em" | "phrase"; kids: ReactNode[] };
  const stack: Node[] = [{ tag: "root", kids: [] }];
  let buf = "";
  let key = 0;
  const top = () => stack[stack.length - 1]!;
  const flush = () => {
    if (buf) top().kids.push(buf);
    buf = "";
  };
  const close = (tag: Node["tag"]) => {
    flush();
    const node = stack.pop()!;
    const el = tag === "em" ? <em key={key++}>{node.kids}</em> : <span key={key++} className={phrase}>{node.kids}</span>;
    top().kids.push(el);
  };
  for (const ch of src) {
    if (ch === "\n") {
      flush();
      top().kids.push(<br key={key++} />);
    } else if (ch === "*") {
      if (top().tag === "em") close("em");
      else if (!stack.some((n) => n.tag === "em")) {
        flush();
        stack.push({ tag: "em", kids: [] });
      } else buf += ch;
    } else if (ch === "[" && top().tag !== "phrase") {
      flush();
      stack.push({ tag: "phrase", kids: [] });
    } else if (ch === "]" && top().tag === "phrase") close("phrase");
    else buf += ch;
  }
  while (stack.length > 1) close(top().tag);
  flush();
  return <>{stack[0]!.kids}</>;
}

export const Arrow = ({ glyph = "↗" }: { glyph?: string }) => (
  <>
    {" "}
    <span aria-hidden="true">{glyph}</span>
  </>
);

export const Icon = ({ name, className }: { name: string; className: string }) =>
  name ? <IconGlyph name={name} className={className} strokeWidth={1.5} /> : null;

type AProps = { link: LinkValue; ctx: BlockContext; className?: string; children: ReactNode } & Record<string, unknown>;
export function A({ link, ctx, className, children, ...rest }: AProps) {
  return (
    <a className={className} href={resolveLink(link, ctx.metadata) ?? "#"} {...linkTarget(link)} {...rest}>
      {children}
    </a>
  );
}

export function Img({
  media,
  ctx,
  className,
  eager,
  decorative,
  size,
}: {
  media: MediaValue | null;
  ctx: BlockContext;
  className?: string;
  eager?: boolean;
  decorative?: boolean;
  /** Fixed width/height attributes: the kit's CSS was tuned against these, not the file's own size. */
  size?: [number, number];
}) {
  const m = resolveMedia(media, ctx.metadata);
  if (!m) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={m.src}
      alt={decorative ? "" : m.alt}
      width={size?.[0] ?? m.width}
      height={size?.[1] ?? m.height}
      loading={eager ? "eager" : "lazy"}
      {...(eager ? { fetchPriority: "high" as const } : {})}
      {...(decorative ? { "aria-hidden": true } : {})}
      style={m.objectPosition ? { objectPosition: m.objectPosition } : undefined}
    />
  );
}

export const mediaSrc = (media: MediaValue | null, ctx: BlockContext) => resolveMedia(media, ctx.metadata)?.src;

export function Eyebrow({ icon, text, light }: { icon: string; text: ReactNode; light?: boolean }) {
  return (
    <p className={light ? "qb-ch-eyebrow qb-ch-eyebrow--light" : "qb-ch-eyebrow"}>
      <Icon name={icon} className="qb-ch-section-icon" /> {text}
    </p>
  );
}

// ------------------------------------------------------------- fields ---

export const lineIcon = (label: string, value: string) => f.icon({ label, default: value });

export const eyebrowFields = (text: string, icon: string) => ({
  eyebrow: f.text({ label: "Eyebrow", default: text }),
  eyebrowIcon: lineIcon("Eyebrow icon", icon),
});

export const headingField = (value: string, label = "Heading") =>
  f.text({
    label,
    default: value,
    multiline: true,
    inline: false,
    description: "New line breaks the line. *Words* in stars get the accent. [Words] in brackets stay on one line.",
  });

export const action = (label: string, href: string, kind: LinkValue["kind"] = "url") =>
  f.group(
    {
      label: f.text({ label: "Label", default: label }),
      link: f.link({ label: "Link", default: { kind, value: href } }),
    },
    { label: "Button", collapsed: true },
  );

export type Action = { label: unknown; link: LinkValue };
export const hasAction = (a: Action) => Boolean(textOf(a.label) && a.link?.value);

export const brandFields = () => ({
  logo: f.media({ label: "Logo mark", accept: "image" }),
  name: f.text({ inline: false, label: "Name", default: "Brand" }),
  tagline: f.text({ label: "Tagline", default: "What you do · Where" }),
});

export function Wordmark({
  brand,
  ctx,
  size,
  className = "qb-ch-wordmark",
}: {
  brand: { logo: MediaValue | null; name: unknown; tagline: unknown };
  ctx: BlockContext;
  size: number;
  className?: string;
}) {
  const src = mediaSrc(brand.logo, ctx);
  return (
    <>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qb-ch-wordmark__mark" src={src} alt="" aria-hidden="true" width={size} height={size} />
      ) : null}
      <span className="qb-ch-wordmark__text">
        <strong>{brand.name as ReactNode}</strong>
        <small>{brand.tagline as ReactNode}</small>
      </span>
    </>
  );
}

export const partnersField = () =>
  f.list(
    {
      name: f.text({ label: "Name", default: "Partner", translatable: false }),
      logo: f.media({ label: "Logo", accept: "image" }),
    },
    { label: "Partners", summary: "name", itemLabel: "Partner" },
  );

/**
 * The drifting logo field: a grid two periods wide and tall, so the diagonal
 * loop is seamless. Tile (r, c) shows logo ((r mod rows) * columns + (c mod columns)) mod n.
 */
export function PartnerField({
  partners,
  ctx,
  variant,
  label,
  columns = 8,
  rows = 4,
  duration,
  hoverRate,
}: {
  partners: { name: unknown; logo: MediaValue | null }[];
  ctx: BlockContext;
  variant: "menu" | "inline";
  label: string;
  columns?: number;
  rows?: number;
  duration: number;
  hoverRate: number;
}) {
  const logos = partners.map((p) => mediaSrc(p.logo, ctx)).filter((s): s is string => Boolean(s));
  const tiles: string[] = [];
  if (logos.length) {
    for (let r = 0; r < rows * 2; r++)
      for (let c = 0; c < columns * 2; c++) tiles.push(logos[((r % rows) * columns + (c % columns)) % logos.length]!);
  }
  return (
    <div
      className={`qb-ch-partner-field qb-ch-partner-field--${variant}`}
      data-ch-partner-field=""
      data-ch-partner-columns={columns}
      data-ch-partner-rows={rows}
      data-ch-partner-duration={duration}
      data-ch-partner-hover-rate={hoverRate}
      role="region"
      aria-label={label}
    >
      <div className="qb-ch-partner-field__viewport" aria-hidden="true">
        <div className="qb-ch-partner-track">
          {tiles.map((src, i) => (
            <div key={i} className="qb-ch-partner-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" width={170} height={78} loading="eager" decoding="async" />
            </div>
          ))}
        </div>
      </div>
      <ul className="qb-ch-visually-hidden qb-ch-partner-names">
        {partners.map((p, i) => (
          <li key={i}>{textOf(p.name)}</li>
        ))}
      </ul>
    </div>
  );
}
