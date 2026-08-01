import { apiFetch } from "./api";
import type { Milestone } from "./cycles";

export type Batch = {
  id: string;
  ownerId: string;
  cropId: string;
  varietyId: string;
  cycleId: string | null;
  quantity: string;
  predictedYield: string;
  actualYield: string | null;
  currentMilestoneOrder: number;
  harvestConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BatchMilestoneProgress = {
  id: string;
  batchId: string;
  milestoneId: string;
  order: number;
  reachedAt: string | null;
  milestone: Milestone;
};

export type ActivityLogEntry = {
  _id: string;
  batchId: string;
  note?: string;
  photos: string[];
  source: "manual" | "ml_model" | "iot_sensor";
  loggedAt: string;
};

export type BatchDetail = Batch & {
  milestoneProgress: BatchMilestoneProgress[];
  activityLog: ActivityLogEntry[];
};

export type CreateBatchInput = {
  cropId: string;
  varietyId: string;
  cycleId: string;
  quantity: number;
  predictedYield: number;
};

export function listBatches(accessToken: string): Promise<Batch[]> {
  return apiFetch<Batch[]>("/batches", accessToken);
}

export function getBatch(
  accessToken: string,
  id: string,
): Promise<BatchDetail> {
  return apiFetch<BatchDetail>(`/batches/${id}`, accessToken);
}

export function createBatch(
  accessToken: string,
  input: CreateBatchInput,
): Promise<Batch> {
  return apiFetch<Batch>("/batches", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function advanceMilestone(
  accessToken: string,
  id: string,
  reachedAt: string,
): Promise<Batch> {
  return apiFetch<Batch>(`/batches/${id}/milestone`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ reachedAt }),
  });
}

export function confirmHarvest(
  accessToken: string,
  id: string,
  actualYield: number,
): Promise<Batch> {
  return apiFetch<Batch>(`/batches/${id}/confirm-harvest`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ actualYield }),
  });
}

export function addActivity(
  accessToken: string,
  id: string,
  input: { note?: string; photos?: string[] },
): Promise<ActivityLogEntry> {
  return apiFetch<ActivityLogEntry>(`/batches/${id}/activity`, accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
