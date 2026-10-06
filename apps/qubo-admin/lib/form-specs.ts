import type { FormValues, MergeSpec } from "@/lib/merge";
import { expandHours, weekdayLabel, weekdays, type OpeningHoursRule } from "@/lib/opening-hours";

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

export function businessSpec(): MergeSpec {
  const spec: MergeSpec = {
    metaTitle: { label: "Site title" },
    metaDescription: { label: "Site description" },
    phone: { label: "Phone" },
    email: { label: "Email" },
    businessType: { label: "Business type", format: (v) => (v ? String(v) : "Local business") },
    latitude: { label: "Latitude" },
    longitude: { label: "Longitude" },
    legalName: { label: "Legal name" },
    legalForm: { label: "Legal form" },
    companyNumber: { label: "Company number" },
    vatNumber: { label: "VAT number" },
    addressLine1: { label: "Address" },
    addressLine2: { label: "Address line 2" },
    postalCode: { label: "Postal code" },
    city: { label: "City" },
    country: { label: "Country" },
  };
  for (const d of weekdays) {
    spec[`hours_${d}_open`] = { label: `${weekdayLabel[d]} open`, format: onOff };
    spec[`hours_${d}_opens`] = { label: `${weekdayLabel[d]} opens` };
    spec[`hours_${d}_closes`] = { label: `${weekdayLabel[d]} closes` };
  }
  return spec;
}
