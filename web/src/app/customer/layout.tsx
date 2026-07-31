import { RequireRole } from "@/components/auth/require-role";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireRole role="CUSTOMER">{children}</RequireRole>;
}
