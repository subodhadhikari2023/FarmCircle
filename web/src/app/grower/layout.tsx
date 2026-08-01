import { RequireRole } from "@/components/auth/require-role";
import { RoleFooter } from "@/components/role-shell/role-footer";
import { RoleHeader } from "@/components/role-shell/role-header";

export default function GrowerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RoleHeader role="GROWER" />
      <RequireRole role="GROWER">{children}</RequireRole>
      <RoleFooter role="GROWER" />
    </>
  );
}
