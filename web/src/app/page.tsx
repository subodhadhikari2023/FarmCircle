import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ValueProps } from "@/components/landing/value-props";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <ValueProps />
      <HowItWorks />
    </main>
  );
}
