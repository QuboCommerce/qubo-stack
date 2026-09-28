"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export function Story() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section
      id="expertise"
      ref={ref}
      className="relative overflow-hidden border-y-2 border-border bg-gradient-to-b from-secondary/60 to-background py-28 dark:from-accent/20"
    >
      {/* Parallax watermark */}
      <motion.span
        aria-hidden
        style={{ y: bgY }}
        className="font-display pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 text-[16rem] leading-none whitespace-nowrap text-foreground/[0.04] uppercase select-none sm:text-[24rem]"
      >
        Froid
      </motion.span>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:gap-20">
        <div>
          <span className="text-xs font-semibold tracking-[0.25em] text-frost-2 uppercase">
            Notre histoire
          </span>
          <h2 className="font-display mt-3 text-4xl tracking-tight uppercase sm:text-5xl">
            Depuis 2006, une obsession&nbsp;:
            <span className="text-frost italic"> le froid.</span>
          </h2>
        </div>

        <div className="space-y-5 text-lg leading-relaxed text-muted-foreground">
          <p>
            Fondée par <strong className="text-foreground">Hilal Mostapha</strong>,
            HM Froid accompagne depuis près de vingt ans les commerçants et
            industriels belges&nbsp;: supermarchés, boucheries, pharmacies,
            glaciers, hôtels et acteurs de la logistique du froid.
          </p>
          <p>
            Chaque installation est pensée comme un engagement&nbsp;: tenir la
            température, jour et nuit, été comme hiver. C&apos;est ce qui fait
            qu&apos;on nous appelle une fois — et qu&apos;on nous rappelle
            pendant vingt ans.
          </p>
          <div className="flex gap-10 pt-2">
            <div>
              <p className="font-display text-4xl text-foreground">500+</p>
              <p className="mt-1 text-sm">Installations réalisées</p>
            </div>
            <div>
              <p className="font-display text-4xl text-foreground">20 ans</p>
              <p className="mt-1 text-sm">D&apos;expertise du froid</p>
            </div>
            <div>
              <p className="font-display text-4xl text-foreground">100%</p>
              <p className="mt-1 text-sm">Belge & indépendant</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
