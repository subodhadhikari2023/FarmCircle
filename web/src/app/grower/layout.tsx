import { RequireRole } from "@/components/auth/require-role";

export default function GrowerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireRole role="GROWER">{children}</RequireRole>;
}
