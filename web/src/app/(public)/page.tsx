import { ClosingCta } from "@/components/landing/closing-cta";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MeetTheGrower } from "@/components/landing/meet-the-grower";
import { Reviews } from "@/components/landing/reviews";
import { ValueProps } from "@/components/landing/value-props";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <ValueProps />
      <HowItWorks />
      <MeetTheGrower />
      <Reviews />
      <Faq />
      <ClosingCta />
    </main>
  );
}
