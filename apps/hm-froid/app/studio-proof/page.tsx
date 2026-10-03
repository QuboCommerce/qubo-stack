import type { Metadata } from "next";
import { registry } from "@qubo/blocks";
import { hmFroidHomeFixture, sampleProducts } from "@qubo/blocks/fixtures";
import { QuboRender } from "@qubo/blocks/render";
import { hmFroidTheme } from "@qubo/stylekit";

// Render proof: a Studio document rendered as a Server Component with the
// HM Froid theme. Not linked anywhere and excluded from indexing.
export const metadata: Metadata = {
  title: "Studio render proof",
  robots: { index: false, follow: false },
};

export default function StudioProofPage() {
  const data = hmFroidHomeFixture();
  const grid = data.content.find((node) => node.type === "ProductGrid");
  return (
    <QuboRender
      registry={registry}
      data={data}
      metadata={{
        theme: hmFroidTheme,
        locale: "fr",
        site: { id: "hm-froid", type: "store", capabilities: ["commerce", "catalog"], name: "HM Froid" },
        data: grid ? { [grid.props.id as string]: sampleProducts } : {},
      }}
    />
  );
}
