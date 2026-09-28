"use client";

import type { Config } from "@measured/puck";
import {
  sectionClasses,
  sectionDefaults,
  sectionFields,
  type SectionProps,
} from "./section";

type HeroProps = SectionProps & {
  eyebrow?: string;
  heading: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

type RichTextProps = SectionProps & { heading?: string; body: string };

type ProductGridProps = SectionProps & {
  heading?: string;
  categorySlug?: string;
  limit: number;
};

type ImageBannerProps = SectionProps & {
  src: string;
  alt: string;
  caption?: string;
};

export type PeltierBlocks = {
  Hero: HeroProps;
  RichText: RichTextProps;
  ProductGrid: ProductGridProps;
  ImageBanner: ImageBannerProps;
};

function Section({
  props,
  children,
}: {
  props: SectionProps;
  children: React.ReactNode;
}) {
  const classes = sectionClasses(props);
  return (
    <section id={props.anchorId || undefined} className={classes.outer}>
      <div className={classes.inner}>{children}</div>
    </section>
  );
}

/**
 * Block registry for the Peltier page editor.
 *
 * Every block spreads sectionFields/sectionDefaults, so section controls stay
 * consistent across the whole design system rather than being bolted onto
 * individual blocks.
 *
 * Blocks render from validated props only. Merchant-authored React is never
 * evaluated here -- AI-assisted authoring should emit a block tree that
 * conforms to this config, which can then be previewed, diffed and rolled back.
 */
export const puckConfig: Config<PeltierBlocks> = {
  components: {
    Hero: {
      label: "Hero",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        heading: { type: "text", label: "Heading" },
        body: { type: "textarea", label: "Body" },
        ctaLabel: { type: "text", label: "Button label" },
        ctaHref: { type: "text", label: "Button link" },
        ...sectionFields,
      },
      defaultProps: {
        heading: "Nouveau titre",
        ...sectionDefaults,
        paddingY: "xl",
      },
      render: (props) => (
        <Section props={props}>
          {props.eyebrow ? (
            <p className="text-sm uppercase tracking-widest opacity-70">
              {props.eyebrow}
            </p>
          ) : null}
          <h1 className="text-4xl font-bold md:text-6xl">{props.heading}</h1>
          {props.body ? (
            <p className="mt-4 max-w-2xl text-lg opacity-80">{props.body}</p>
          ) : null}
          {props.ctaLabel ? (
            <a
              href={props.ctaHref || "#"}
              className="mt-6 inline-block rounded-md border px-5 py-2 font-medium"
            >
              {props.ctaLabel}
            </a>
          ) : null}
        </Section>
      ),
    },

    RichText: {
      label: "Rich text",
      fields: {
        heading: { type: "text", label: "Heading" },
        body: { type: "textarea", label: "Body" },
        ...sectionFields,
      },
      defaultProps: { body: "Votre texte ici.", ...sectionDefaults },
      render: (props) => (
        <Section props={props}>
          {props.heading ? (
            <h2 className="mb-3 text-2xl font-semibold">{props.heading}</h2>
          ) : null}
          <p className="whitespace-pre-line leading-relaxed">{props.body}</p>
        </Section>
      ),
    },

    ProductGrid: {
      label: "Product grid",
      fields: {
        heading: { type: "text", label: "Heading" },
        categorySlug: { type: "text", label: "Category slug" },
        limit: { type: "number", label: "Number of products", min: 1, max: 48 },
        ...sectionFields,
      },
      defaultProps: { limit: 8, ...sectionDefaults },
      render: (props) => (
        <Section props={props}>
          {props.heading ? (
            <h2 className="mb-4 text-2xl font-semibold">{props.heading}</h2>
          ) : null}
          {/* Editor placeholder. The storefront resolves real products via
              @peltier/storefront so pricing stays tenant- and group-aware. */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: Math.min(props.limit, 8) }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-md border border-dashed opacity-60"
              />
            ))}
          </div>
          <p className="mt-3 text-sm opacity-60">
            {props.categorySlug
              ? `Catégorie : ${props.categorySlug}`
              : "Tous les produits"}
          </p>
        </Section>
      ),
    },

    ImageBanner: {
      label: "Image banner",
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt text" },
        caption: { type: "text", label: "Caption" },
        ...sectionFields,
      },
      defaultProps: { src: "", alt: "", ...sectionDefaults },
      render: (props) => (
        <Section props={props}>
          {props.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.src}
              alt={props.alt}
              className="w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed opacity-60">
              Choisir une image
            </div>
          )}
          {props.caption ? (
            <p className="mt-2 text-sm opacity-70">{props.caption}</p>
          ) : null}
        </Section>
      ),
    },
  },
};
