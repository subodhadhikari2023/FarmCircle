import { RequireRole } from "@/components/auth/require-role";
import { RoleFooter } from "@/components/role-shell/role-footer";
import { RoleHeader } from "@/components/role-shell/role-header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RoleHeader role="ADMIN" />
      <RequireRole role="ADMIN">{children}</RequireRole>
      <RoleFooter role="ADMIN" />
    </>
  );
}
