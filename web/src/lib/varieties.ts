import { apiFetch } from "./api";

export type Variety = {
  id: string;
  cropId: string;
  name: string;
  createdAt: string;
};

export function listVarieties(
  accessToken: string,
  cropId: string,
): Promise<Variety[]> {
  return apiFetch<Variety[]>(`/crops/${cropId}/varieties`, accessToken);
}

export function createVariety(
  accessToken: string,
  cropId: string,
  name: string,
): Promise<Variety> {
  return apiFetch<Variety>(`/crops/${cropId}/varieties`, accessToken, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameVariety(
  accessToken: string,
  id: string,
  name: string,
): Promise<Variety> {
  return apiFetch<Variety>(`/varieties/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteVariety(
  accessToken: string,
  id: string,
): Promise<void> {
  return apiFetch<void>(`/varieties/${id}`, accessToken, {
    method: "DELETE",
  });
}
