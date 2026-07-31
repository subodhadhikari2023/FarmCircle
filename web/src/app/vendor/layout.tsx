import { RequireRole } from "@/components/auth/require-role";

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireRole role="VENDOR">{children}</RequireRole>;
}
