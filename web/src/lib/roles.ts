import type { Role } from "./auth-context";

export const ROLE_HOME: Record<Role, string> = {
  GROWER: "/grower",
  VENDOR: "/vendor",
  CUSTOMER: "/customer",
  ADMIN: "/admin",
};
