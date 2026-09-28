"use client";

import { Snowflake } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/shop", label: "Boutique" },
  { href: "#equipements", label: "Équipements" },
  { href: "#expertise", label: "Expertise" },
  { href: "#processus", label: "Processus" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav className="glass mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full border-2 border-border pl-5 pr-2 shadow-lg shadow-black/5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Snowflake className="size-4" />
          </span>
          <span className="font-display text-lg tracking-wide">HM FROID</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="#contact"
            className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <Snowflake className="size-3.5" />
            Devis gratuit
          </a>
        </div>
      </nav>
    </header>
  );
}
