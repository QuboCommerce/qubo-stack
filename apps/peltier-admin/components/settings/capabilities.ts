import { BookOpen, CalendarCheck, Languages, MessageSquareText, Package, ShoppingCart, UserRound, type LucideIcon } from "lucide-react";

export const capabilityMeta: Record<string, { label: string; description: string; icon: LucideIcon }> = {
  commerce: { label: "Selling", description: "Cart, checkout, orders, payments and shipping.", icon: ShoppingCart },
  catalog: { label: "Catalog", description: "Products, collections, brands and inventory.", icon: Package },
  booking: { label: "Bookings", description: "Services with appointments and availability.", icon: CalendarCheck },
  leads: { label: "Leads & forms", description: "Contact forms, quote requests and an inbox.", icon: MessageSquareText },
  blog: { label: "Blog", description: "Articles, authors and tags.", icon: BookOpen },
  accounts: { label: "Customer accounts", description: "Sign-in, order history and saved addresses.", icon: UserRound },
  locales: { label: "Multiple languages", description: "Serve translated content in more than one language.", icon: Languages },
};
