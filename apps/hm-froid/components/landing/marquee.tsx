"use client";

import { Snowflake } from "lucide-react";

const clients = [
  "Supermarchés",
  "Pharmacies",
  "Hôtels",
  "Boucheries",
  "Glaciers",
  "Restaurants",
  "Laboratoires",
  "Logistique froide",
];

export function Marquee() {
  const row = [...clients, ...clients];

  return (
    <section className="border-y-2 border-border bg-card/50 py-10">
      <p className="text-center text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
        Ils nous font confiance pour garder le froid
      </p>
      <div className="marquee-mask mt-6 overflow-hidden">
        <div className="flex w-max animate-[marquee_28s_linear_infinite] items-center gap-10 pr-10">
          {row.map((client, i) => (
            <span
              key={i}
              className="flex items-center gap-3 text-lg font-semibold whitespace-nowrap text-muted-foreground"
            >
              <Snowflake className="size-4 text-frost-2" />
              {client}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
