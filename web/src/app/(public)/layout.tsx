import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}
