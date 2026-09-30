import Link from "next/link";
import { ClipboardList, LayoutDashboard, Package, Users } from "lucide-react";
import { requireAdminContext } from "@/lib/admin";
import { SignOutButton } from "@/components/sign-out-button";

const navigation = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/products", label: "Produits", icon: Package },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/orders", label: "Commandes", icon: ClipboardList },
];

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const context = await requireAdminContext();

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background md:block">
        <div className="border-b px-6 py-5">
          <p className="text-lg font-semibold">HM Froid</p>
          <p className="truncate text-sm text-muted-foreground">
            {context.siteName}
          </p>
        </div>
        <nav className="space-y-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent"
              href={href}
              key={href}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="flex min-h-16 items-center justify-between border-b bg-background px-4 md:px-8">
          <nav className="flex gap-3 text-sm md:hidden">
            {navigation.map(({ href, label }) => (
              <Link href={href} key={href}>{label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{context.user.name}</p>
              <p className="text-xs text-muted-foreground">{context.user.role}</p>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
