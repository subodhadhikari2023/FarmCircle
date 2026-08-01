import type { Role } from "./auth-context";

type RoleShellLink = {
  label: string;
  href: string;
};

type RoleShellConfig = {
  label: string;
  icon: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  links: RoleShellLink[];
};

// Role -> color mapping is fixed, see docs/FarmCircle-Design-System.md §1.
// `border` uses the raw ramp scale directly (role-color badge exception);
// `badgeBg`/`badgeText` pair a light tint with a dark shade of the same
// hue so the role label stays AA-readable (see the icy-aqua note in
// globals.css — the mid ramp stops aren't safe as text).
export const ROLE_SHELL: Record<Role, RoleShellConfig> = {
  GROWER: {
    label: "Grower",
    icon: "eco",
    border: "border-icy-aqua-500",
    badgeBg: "bg-icy-aqua-50",
    badgeText: "text-icy-aqua-800",
    links: [
      { label: "Crops", href: "/grower/crops" },
      { label: "Cycles", href: "/grower/cycles" },
      { label: "Batches", href: "/grower/batches" },
      { label: "Listings", href: "/grower/listings" },
      { label: "Orders", href: "/grower/orders" },
    ],
  },
  VENDOR: {
    label: "Vendor",
    icon: "storefront",
    border: "border-frosted-blue-500",
    badgeBg: "bg-frosted-blue-50",
    badgeText: "text-frosted-blue-800",
    links: [{ label: "Browse", href: "/listings" }],
  },
  CUSTOMER: {
    label: "Customer",
    icon: "shopping_basket",
    border: "border-lavender-grey-500",
    badgeBg: "bg-lavender-grey-100",
    badgeText: "text-lavender-grey-800",
    links: [
      { label: "Browse", href: "/listings" },
      { label: "My orders", href: "/customer/orders" },
      { label: "Addresses", href: "/customer/addresses" },
    ],
  },
  ADMIN: {
    label: "Admin",
    icon: "admin_panel_settings",
    border: "border-dark-slate-grey-700",
    badgeBg: "bg-dark-slate-grey-100",
    badgeText: "text-dark-slate-grey-800",
    links: [],
  },
};
