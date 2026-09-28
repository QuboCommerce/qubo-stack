import { Snowflake } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t-2 border-border bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Snowflake className="size-4" />
          </span>
          <span className="font-display text-lg tracking-wide">HM FROID</span>
        </Link>

        <p className="text-sm text-muted-foreground">
          Réfrigération professionnelle — Belgique
        </p>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} HM Froid. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
