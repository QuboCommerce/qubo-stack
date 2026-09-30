import { redirect } from "next/navigation";
import { EmptyState } from "@/components/page";
import { getUserSites } from "@/lib/admin";
import { Globe } from "lucide-react";

export default async function Root() {
  const sites = await getUserSites();
  if (sites[0]) redirect(`/${sites[0].slug}`);
  return (
    <main className="grid min-h-dvh place-items-center">
      <EmptyState icon={Globe} title="No sites yet" description="Your account isn't linked to any organization site." />
    </main>
  );
}
