"use client";

import { motion } from "motion/react";
import {
  AirVent,
  Refrigerator,
  Snowflake,
  ThermometerSnowflake,
} from "lucide-react";

const items = [
  {
    icon: Snowflake,
    title: "Chambres froides",
    description:
      "Positives ou négatives, sur mesure, pour stocker vos denrées à la température exacte.",
  },
  {
    icon: Refrigerator,
    title: "Vitrines réfrigérées",
    description:
      "Mettez vos produits en valeur tout en respectant la chaîne du froid, du comptoir au libre-service.",
  },
  {
    icon: ThermometerSnowflake,
    title: "Refroidisseurs industriels",
    description:
      "Groupes frigorifiques et chillers dimensionnés pour vos process les plus exigeants.",
  },
  {
    icon: AirVent,
    title: "Climatisation & pompes à chaleur",
    description:
      "Confort thermique toute l'année pour vos espaces commerciaux et professionnels.",
  },
];

export function Equipment() {
  return (
    <section id="equipements" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold tracking-[0.25em] text-frost-2 uppercase">
          Équipements
        </span>
        <h2 className="font-display mt-3 text-4xl tracking-tight uppercase sm:text-5xl">
          Du comptoir à <span className="text-frost italic">l&apos;usine.</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Vente, installation et maintenance d&apos;équipements frigorifiques
          professionnels, choisis chez les meilleurs fabricants européens.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
            className="group rounded-3xl border-2 border-border bg-card p-6 transition-all hover:-translate-y-1.5 hover:border-ring hover:shadow-xl hover:shadow-primary/10"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <item.icon className="size-6" />
            </span>
            <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
