import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Header + body for a settings sub-page. The back arrow only shows when the list is hidden. */
export function SettingsPage({
  site,
  title,
  description,
  actions,
  children,
}: {
  site: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2 px-3 xs:px-0 sm:mb-6 @min-[52rem]:pt-1">
        <Link href={`/${site}/settings`} className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg hover:bg-accent @min-[52rem]:hidden" aria-label="All settings">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-[1.375rem] @min-[52rem]:text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="space-y-4 sm:space-y-5">{children}</div>
    </div>
  );
}
