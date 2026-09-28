import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Marquee } from "@/components/landing/marquee";
import { Equipment } from "@/components/landing/equipment";
import { Story } from "@/components/landing/story";
import { Process } from "@/components/landing/process";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Marquee />
      <Equipment />
      <Story />
      <Process />
      <Cta />
      <Footer />
    </main>
  );
}
