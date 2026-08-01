import { apiFetch } from "./api";

export type Cycle = {
  id: string;
  cropId: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Milestone = {
  id: string;
  cycleId: string;
  name: string;
  order: number;
  expectedDurationDays: number;
};

export type CycleWithMilestones = Cycle & { milestones: Milestone[] };

export function listCycles(
  accessToken: string,
  cropId?: string,
): Promise<Cycle[]> {
  const query = cropId ? `?cropId=${encodeURIComponent(cropId)}` : "";
  return apiFetch<Cycle[]>(`/cycles${query}`, accessToken);
}

export function getCycle(
  accessToken: string,
  id: string,
): Promise<CycleWithMilestones> {
  return apiFetch<CycleWithMilestones>(`/cycles/${id}`, accessToken);
}

export function createCycle(
  accessToken: string,
  cropId: string,
  name: string,
): Promise<Cycle> {
  return apiFetch<Cycle>("/cycles", accessToken, {
    method: "POST",
    body: JSON.stringify({ cropId, name }),
  });
}

export function renameCycle(
  accessToken: string,
  id: string,
  name: string,
): Promise<Cycle> {
  return apiFetch<Cycle>(`/cycles/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteCycle(accessToken: string, id: string): Promise<void> {
  return apiFetch<void>(`/cycles/${id}`, accessToken, { method: "DELETE" });
}
