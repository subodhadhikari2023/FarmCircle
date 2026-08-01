import { apiFetch } from "./api";

export type Crop = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export function listCrops(accessToken: string): Promise<Crop[]> {
  return apiFetch<Crop[]>("/crops", accessToken);
}

export function getCrop(accessToken: string, id: string): Promise<Crop> {
  return apiFetch<Crop>(`/crops/${id}`, accessToken);
}

export function createCrop(
  accessToken: string,
  name: string,
): Promise<Crop> {
  return apiFetch<Crop>("/crops", accessToken, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameCrop(
  accessToken: string,
  id: string,
  name: string,
): Promise<Crop> {
  return apiFetch<Crop>(`/crops/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteCrop(accessToken: string, id: string): Promise<void> {
  return apiFetch<void>(`/crops/${id}`, accessToken, { method: "DELETE" });
}
