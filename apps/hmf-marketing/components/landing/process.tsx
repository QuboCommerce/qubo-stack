"use client";

import { motion } from "motion/react";
import { ClipboardCheck, DraftingCompass, Wrench, PhoneCall } from "lucide-react";

const steps = [
  {
    icon: ClipboardCheck,
    title: "Visite technique",
    description:
      "Nous venons sur place, mesurons vos contraintes réelles et écoutons vos besoins.",
  },
  {
    icon: DraftingCompass,
    title: "Conception sur mesure",
    description:
      "Dimensionnement précis, choix des équipements et devis transparent, sans surprise.",
  },
  {
    icon: Wrench,
    title: "Installation certifiée",
    description:
      "Pose soignée par nos frigoristes, mise en service et contrôle des températures.",
  },
  {
    icon: PhoneCall,
    title: "Maintenance 24/7",
    description:
      "Entretien préventif et dépannage d'urgence — parce que le froid n'attend pas.",
  },
];

export function Process() {
  return (
    <section id="processus" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold tracking-[0.25em] text-frost-2 uppercase">
          Processus
        </span>
        <h2 className="font-display mt-3 text-4xl tracking-tight uppercase sm:text-5xl">
          Quatre étapes, <span className="text-frost italic">zéro degré</span>{" "}
          d&apos;improvisation.
        </h2>
      </div>

      <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
            className="relative rounded-3xl border-2 border-border bg-card p-6"
          >
            <span className="font-display absolute top-5 right-6 text-4xl text-foreground/10">
              0{i + 1}
            </span>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
              <step.icon className="size-5" />
            </span>
            <h3 className="mt-5 font-bold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
