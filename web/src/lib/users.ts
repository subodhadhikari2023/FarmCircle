import { apiFetch } from "./api";
import type { Role } from "./auth-context";

// Admin-only. GET/PATCH /users(...) only ever return Vendor/Customer rows —
// Grower and Admin accounts are excluded server-side (UsersService.MANAGEABLE_ROLES).
export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listUsers(accessToken: string): Promise<ManagedUser[]> {
  return apiFetch<ManagedUser[]>("/users", accessToken);
}

export function getUser(
  accessToken: string,
  id: string,
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/users/${id}`, accessToken);
}

export function suspendUser(
  accessToken: string,
  id: string,
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/users/${id}/suspend`, accessToken, {
    method: "PATCH",
  });
}

export function reactivateUser(
  accessToken: string,
  id: string,
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/users/${id}/reactivate`, accessToken, {
    method: "PATCH",
  });
}
