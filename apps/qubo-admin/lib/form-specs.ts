import type { FormValues, MergeSpec } from "@/lib/merge";
import type { getTranslations } from "next-intl/server";
import { expandHours, weekdays, type OpeningHoursRule } from "@/lib/opening-hours";

type SettingsT = Awaited<ReturnType<typeof getTranslations<"settings">>>;

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

export function siteGeneralSpec(labels: { type: (t: string) => string; capability: (c: string) => string }, t: SettingsT): MergeSpec {
  return {
    name: { label: t("fields.siteName") },
    description: { label: t("fields.shortDescription") },
    currency: { label: t("fields.currency") },
    type: { label: t("fields.siteType"), format: (v) => labels.type(String(v)) },
    capabilities: { label: t("fields.features"), multi: true, format: (v) => (Array.isArray(v) && v.length ? v.map(labels.capability).join(", ") : t("fields.none")) },
  };
}

type BusinessSettingsRow = {
  metaTitle: string | null;
  metaDescription: string | null;
  phone: string | null;
  email: string | null;
  businessType: string | null;
  latitude: string | null;
  longitude: string | null;
  openingHours: OpeningHoursRule[];
};
type OrganizationRow = {
  legalName: string | null;
  legalForm: string | null;
  companyNumber: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
};

/** Business & SEO form: site settings plus the organisation's legal identity, hours expanded per day. */
export function businessValues(s: BusinessSettingsRow | null | undefined, o: OrganizationRow): FormValues {
  const hours = expandHours(s?.openingHours ?? []);
  const values: FormValues = {
    metaTitle: s?.metaTitle ?? "",
    metaDescription: s?.metaDescription ?? "",
    phone: s?.phone ?? "",
    email: s?.email ?? "",
    businessType: s?.businessType ?? "",
    latitude: s?.latitude ?? "",
    longitude: s?.longitude ?? "",
    legalName: o.legalName ?? "",
    legalForm: o.legalForm ?? "",
    companyNumber: o.companyNumber ?? "",
    vatNumber: o.vatNumber ?? "",
    addressLine1: o.addressLine1 ?? "",
    addressLine2: o.addressLine2 ?? "",
    postalCode: o.postalCode ?? "",
    city: o.city ?? "",
    country: o.country ?? "",
  };
  for (const d of weekdays) {
    const day = hours[d];
    values[`hours_${d}_open`] = day.open ? "on" : "";
    values[`hours_${d}_opens`] = day.opens;
    values[`hours_${d}_closes`] = day.closes;
  }
  return values;
}

export function businessSpec(t: SettingsT): MergeSpec {
  const switchText = (v: unknown) => (v === "on" ? t("fields.on") : t("fields.off"));
  const spec: MergeSpec = {
    metaTitle: { label: t("fields.siteTitle") },
    metaDescription: { label: t("fields.siteDescription") },
    phone: { label: t("fields.phone") },
    email: { label: t("fields.email") },
    businessType: { label: t("fields.businessType"), format: (v) => (v ? String(v) : t("fields.localBusiness")) },
    latitude: { label: t("fields.latitude") },
    longitude: { label: t("fields.longitude") },
    legalName: { label: t("fields.legalName") },
    legalForm: { label: t("fields.legalForm") },
    companyNumber: { label: t("fields.companyNumber") },
    vatNumber: { label: t("fields.vatNumber") },
    addressLine1: { label: t("fields.address") },
    addressLine2: { label: t("fields.addressLine2") },
    postalCode: { label: t("fields.postalCode") },
    city: { label: t("fields.city") },
    country: { label: t("fields.country") },
  };
  for (const d of weekdays) {
    const day = t(`weekdays.${d}`);
    spec[`hours_${d}_open`] = { label: t("hours.open", { day }), format: switchText };
    spec[`hours_${d}_opens`] = { label: t("hours.opens", { day }) };
    spec[`hours_${d}_closes`] = { label: t("hours.closes", { day }) };
  }
  return spec;
}
