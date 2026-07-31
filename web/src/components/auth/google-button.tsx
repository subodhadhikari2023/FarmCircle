import { API_URL } from "@/lib/api";

type GoogleButtonProps = {
  label: string;
  /**
   * The backend requires ?role=VENDOR|CUSTOMER on GET /auth/google — it's
   * only applied when the Google sign-in creates a brand-new account; an
   * existing user's stored role wins regardless of what's passed here.
   */
  role: "VENDOR" | "CUSTOMER";
};

export function GoogleButton({ label, role }: GoogleButtonProps) {
  return (
    <a
      href={`${API_URL}/auth/google?role=${role}`}
      className="block w-full rounded-sm border border-border bg-surface px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-background"
    >
      {label}
    </a>
  );
}
