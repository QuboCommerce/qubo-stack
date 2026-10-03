import Link from "next/link";
import { Construction } from "lucide-react";
import { EmptyState, Page, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";

export default async function ComingSoon({ params }: { params: Promise<{ site: string; rest: string[] }> }) {
  const { site: slug, rest } = await params;
  const { site } = await requireSite(slug);
  const title = rest
    .at(-1)!
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <Page title={title} backHref={rest.length > 1 ? `/${site.slug}/${rest.slice(0, -1).join("/")}` : undefined}>
      <Panel>
        <EmptyState
          icon={Construction}
          title="This area is on the roadmap"
          description={`“${title}” is part of an upcoming Qubo milestone. The navigation is already wired so nothing moves when it lands.`}
          action={<Button variant="outline" size="sm" asChild><Link href={`/${site.slug}`}>Back to Home</Link></Button>}
        />
      </Panel>
    </Page>
  );
}
