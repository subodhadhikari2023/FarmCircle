import { RequireRole } from "@/components/auth/require-role";
import { RoleFooter } from "@/components/role-shell/role-footer";
import { RoleHeader } from "@/components/role-shell/role-header";

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RoleHeader role="VENDOR" />
      <RequireRole role="VENDOR">{children}</RequireRole>
      <RoleFooter role="VENDOR" />
    </>
  );
}
