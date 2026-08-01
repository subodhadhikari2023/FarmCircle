import { apiFetch } from "./api";
import type { Milestone } from "./cycles";

export type { Milestone };

export type MilestoneInput = {
  name: string;
  order: number;
  expectedDurationDays: number;
};

export function createMilestone(
  accessToken: string,
  cycleId: string,
  input: MilestoneInput,
): Promise<Milestone> {
  return apiFetch<Milestone>(`/cycles/${cycleId}/milestones`, accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMilestone(
  accessToken: string,
  id: string,
  input: Partial<MilestoneInput>,
): Promise<Milestone> {
  return apiFetch<Milestone>(`/milestones/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMilestone(
  accessToken: string,
  id: string,
): Promise<void> {
  return apiFetch<void>(`/milestones/${id}`, accessToken, {
    method: "DELETE",
  });
}
