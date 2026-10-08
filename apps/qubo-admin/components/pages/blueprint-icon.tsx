import { Building2, CircleHelp, FileText, MapPin, Network, Scale, ShieldCheck, Truck, Wrench, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  scale: Scale,
  "shield-check": ShieldCheck,
  "file-text": FileText,
  truck: Truck,
  wrench: Wrench,
  "building-2": Building2,
  "map-pin": MapPin,
  network: Network,
  "circle-help": CircleHelp,
};

/** Blueprints name lucide icons as strings; the admin maps them to components. */
export const blueprintIcon = (name: string): LucideIcon => icons[name] ?? FileText;
