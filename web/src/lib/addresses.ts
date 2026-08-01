import { apiFetch } from "./api";

export type Address = {
  id: string;
  userId: string;
  addressText: string;
  landmark: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
};

export type CreateAddressInput = {
  addressText: string;
  landmark?: string;
  latitude: number;
  longitude: number;
};

export function listAddresses(accessToken: string): Promise<Address[]> {
  return apiFetch<Address[]>("/users/me/addresses", accessToken);
}

export function createAddress(
  accessToken: string,
  input: CreateAddressInput,
): Promise<Address> {
  return apiFetch<Address>("/users/me/addresses", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
