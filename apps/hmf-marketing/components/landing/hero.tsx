"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef } from "react";

const IceCube = dynamic(() => import("./ice-cube"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="font-display text-7xl text-frost opacity-40">HM</span>
    </div>
  ),
});

const stats = [
  { value: "±0,3 °C", label: "Précision de régulation" },
  { value: "24/7", label: "Dépannage d'urgence" },
  { value: "2006", label: "À votre service depuis" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.12 * i,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // Parallax: the cube drifts slower than the page, the text a bit faster
  const cubeY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden pt-36 pb-16 md:pt-44"
    >
      {/* backdrop glow */}
      <motion.div
        style={{ opacity: glowOpacity }}
        className="frost-glow pointer-events-none absolute top-0 right-[-10%] h-[46rem] w-[46rem]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div style={{ y: textY }} className="relative z-10">
          <motion.span
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-4 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            <span className="size-1.5 rounded-full bg-frost-2" />
            Réfrigération professionnelle — depuis 2006
          </motion.span>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="font-display mt-6 text-6xl leading-[0.95] tracking-tight uppercase sm:text-7xl lg:text-8xl"
          >
            Le froid,
            <br />
            <span className="italic">parfaitement</span>
            <br />
            <span className="text-frost">maîtrisé.</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground"
          >
            Vitrines réfrigérées, chambres froides et refroidisseurs
            industriels — conçus, installés et entretenus pour tenir la
            température exacte dont votre activité dépend.
          </motion.p>

          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href="#equipements"
              className="group flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Découvrir nos équipements
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#contact"
              className="flex h-12 items-center rounded-full border-2 border-border bg-card px-6 font-semibold transition-colors hover:border-ring"
            >
              Planifier une visite
            </a>
          </motion.div>

          <motion.dl
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-12 flex gap-10"
          >
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-3xl sm:text-4xl">
                  {stat.value}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {stat.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* 3D ice cube */}
        <motion.div
          style={{ y: cubeY }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-[26rem] sm:h-[32rem] lg:h-[36rem]"
        >
          <div className="frost-glow absolute inset-0 scale-125" />
          <IceCube />
        </motion.div>
      </div>
    </section>
  );
}
