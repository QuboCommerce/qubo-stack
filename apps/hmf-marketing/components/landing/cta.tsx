"use client";

import { motion } from "motion/react";
import { ArrowRight, Snowflake } from "lucide-react";

export function Cta() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[2.5rem] border-2 border-border bg-gradient-to-br from-primary via-primary to-frost-2 px-8 py-16 text-center text-primary-foreground sm:px-16 sm:py-20 dark:from-accent dark:via-card dark:to-accent dark:text-foreground"
      >
        <Snowflake
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-48 opacity-10"
        />
        <Snowflake
          aria-hidden
          className="pointer-events-none absolute -bottom-14 -left-14 size-56 opacity-10"
        />

        <h2 className="font-display mx-auto max-w-2xl text-4xl tracking-tight uppercase sm:text-6xl">
          Prêt à passer au <span className="italic">froid parfait&nbsp;?</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg opacity-85">
          Racontez-nous votre projet. Nous revenons vers vous sous 24&nbsp;h
          avec une première recommandation — gratuite et sans engagement.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a
            href="mailto:info@hmfroid.be"
            className="group flex h-13 items-center gap-2 rounded-full bg-background px-7 font-semibold text-foreground shadow-xl transition-transform hover:scale-[1.04] active:scale-[0.98]"
          >
            Demander un devis gratuit
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="tel:+3200000000"
            className="flex h-13 items-center rounded-full border-2 border-current/30 px-7 font-semibold transition-colors hover:border-current/60"
          >
            Appeler un frigoriste
          </a>
        </div>
      </motion.div>
    </section>
  );
}
