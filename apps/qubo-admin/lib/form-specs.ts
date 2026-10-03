import type { FormValues, MergeSpec } from "@/lib/merge";

const onOff = (v: unknown) => (v === "on" ? "On" : "Off");
const names = (lookup: Map<string, string>) => (v: unknown) =>
  Array.isArray(v) && v.length ? v.map((id) => lookup.get(id) ?? "Deleted category").join(", ") : "None";

/** Field values exactly as the product form renders and submits them. */
type ProductRow = {
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  weight: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isArchived: boolean;
  isFeatured: boolean;
};

export function productValues(p: ProductRow, categoryIds: string[]): FormValues {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    brand: p.brand ?? "",
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice ?? "",
    weight: p.weight ?? "",
    width: p.width ?? "",
    height: p.height ?? "",
    depth: p.depth ?? "",
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    status: p.isArchived ? "archived" : "active",
    isFeatured: p.isFeatured ? "on" : "",
    categoryIds: [...categoryIds].sort(),
  };
}

export function productSpec(categoryNames: Map<string, string>): MergeSpec {
  return {
    name: { label: "Title" },
    slug: { label: "Handle" },
    description: { label: "Description" },
    brand: { label: "Brand" },
    basePrice: { label: "Price" },
    compareAtPrice: { label: "Compare-at price" },
    weight: { label: "Weight" },
    width: { label: "Width" },
    height: { label: "Height" },
    depth: { label: "Depth" },
    metaTitle: { label: "Page title" },
    metaDescription: { label: "Meta description" },
    status: { label: "Status", format: (v) => (v === "archived" ? "Archived" : "Active") },
    isFeatured: { label: "Featured", format: onOff },
    categoryIds: { label: "Categories", multi: true, format: names(categoryNames) },
  };
}

type CategoryRow = { name: string; slug: string; description: string | null; parentId: string | null };

export function categoryValues(c: CategoryRow): FormValues {
  return { name: c.name, slug: c.slug, description: c.description ?? "", parentId: c.parentId ?? "" };
}

export function categorySpec(categoryNames: Map<string, string>): MergeSpec {
  return {
    name: { label: "Name" },
    slug: { label: "Handle" },
    description: { label: "Description" },
    parentId: { label: "Parent category", format: (v) => (v ? (categoryNames.get(String(v)) ?? "Deleted category") : "None (top level)") },
  };
}

type SiteRow = { name: string; description: string | null; currency: string | null; type: string; capabilities: string[] | null };

export function siteGeneralValues(s: SiteRow): FormValues {
  return {
    name: s.name,
    description: s.description ?? "",
    currency: s.currency ?? "",
    type: s.type,
    capabilities: [...(s.capabilities ?? [])].sort(),
  };
}

export function siteGeneralSpec(labels: { type: (t: string) => string; capability: (c: string) => string }): MergeSpec {
  return {
    name: { label: "Site name" },
    description: { label: "Short description" },
    currency: { label: "Currency" },
    type: { label: "Site type", format: (v) => labels.type(String(v)) },
    capabilities: { label: "Features", multi: true, format: (v) => (Array.isArray(v) && v.length ? v.map(labels.capability).join(", ") : "None") },
  };
}
