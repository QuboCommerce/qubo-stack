import { Blocks, Building2, CalendarCheck, Newspaper, Store, type LucideIcon } from "lucide-react";

export const siteTypeIcon: Record<string, LucideIcon> = {
  store: Store,
  services: CalendarCheck,
  business: Building2,
  editorial: Newspaper,
  custom: Blocks,
};
