import type { Role } from "./auth-context";

type RoleShellLink = {
  label: string;
  href: string;
  icon: string;
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
      { label: "Crops", href: "/grower/crops", icon: "grass" },
      { label: "Cycles", href: "/grower/cycles", icon: "cyclone" },
      { label: "Batches", href: "/grower/batches", icon: "inventory_2" },
      { label: "Listings", href: "/grower/listings", icon: "sell" },
      { label: "Orders", href: "/grower/orders", icon: "receipt_long" },
    ],
  },
  VENDOR: {
    label: "Vendor",
    icon: "storefront",
    border: "border-frosted-blue-500",
    badgeBg: "bg-frosted-blue-50",
    badgeText: "text-frosted-blue-800",
    links: [
      { label: "Browse", href: "/vendor", icon: "storefront" },
      { label: "Pre-book", href: "/vendor/upcoming", icon: "event_available" },
      { label: "My pre-bookings", href: "/vendor/prebookings", icon: "bookmark" },
      { label: "My orders", href: "/vendor/orders", icon: "receipt_long" },
      { label: "Addresses", href: "/vendor/addresses", icon: "location_on" },
    ],
  },
  CUSTOMER: {
    label: "Customer",
    icon: "shopping_basket",
    border: "border-lavender-grey-500",
    badgeBg: "bg-lavender-grey-100",
    badgeText: "text-lavender-grey-800",
    links: [
      { label: "Browse", href: "/customer", icon: "shopping_basket" },
      { label: "My orders", href: "/customer/orders", icon: "receipt_long" },
      { label: "Addresses", href: "/customer/addresses", icon: "location_on" },
    ],
  },
  ADMIN: {
    label: "Admin",
    icon: "admin_panel_settings",
    border: "border-dark-slate-grey-700",
    badgeBg: "bg-dark-slate-grey-100",
    badgeText: "text-dark-slate-grey-800",
    links: [
      { label: "Users", href: "/admin/users", icon: "group" },
      { label: "Orders", href: "/admin/orders", icon: "receipt_long" },
      { label: "Pre-bookings", href: "/admin/prebookings", icon: "bookmark" },
      { label: "Reviews", href: "/admin/reviews", icon: "reviews" },
    ],
  },
};
