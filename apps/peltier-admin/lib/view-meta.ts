import {
  BookOpen,
  CircleHelp,
  FileText,
  Home,
  LayoutList,
  Lock,
  Package,
  PanelBottom,
  PanelTop,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  Wrench,
  CalendarDays,
  Newspaper,
  Layers,
  type LucideIcon,
} from "lucide-react";

/** Icon per Studio resource kind (templates) and section group. */
export const viewIcons: Record<string, LucideIcon> = {
  home: Home,
  page: FileText,
  product: Package,
  collection: Layers,
  collection_list: LayoutList,
  cart: ShoppingCart,
  search: Search,
  account: User,
  service: Wrench,
  booking: CalendarDays,
  blog: Newspaper,
  article: BookOpen,
  not_found: CircleHelp,
  password: Lock,
  maintenance: Sparkles,
  header: PanelTop,
  footer: PanelBottom,
  overlay: Layers,
};

/** `template:<id>` → `/studio/template/<id>` */
export const studioHref = (site: string, key: string) => `/${site}/studio/${key.replace(":", "/")}`;
