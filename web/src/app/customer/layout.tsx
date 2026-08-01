import { RequireRole } from "@/components/auth/require-role";
import { RoleFooter } from "@/components/role-shell/role-footer";
import { RoleHeader } from "@/components/role-shell/role-header";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RoleHeader role="CUSTOMER" />
      <RequireRole role="CUSTOMER">{children}</RequireRole>
      <RoleFooter role="CUSTOMER" />
    </>
  );
}
