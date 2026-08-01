import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <NotFoundContent />
      <Footer />
    </>
  );
}
