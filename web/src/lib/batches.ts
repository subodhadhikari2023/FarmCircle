import { API_URL } from "./api";

export type MilestoneProgress = {
  order: number;
  reachedAt: string | null;
  milestone: {
    name: string;
    order: number;
    expectedDurationDays: number;
  };
};

export type BatchTimeline = {
  id: string;
  currentMilestoneOrder: number;
  harvestConfirmed: boolean;
  milestoneProgress: MilestoneProgress[];
};

export async function getBatchTimeline(
  id: string,
): Promise<BatchTimeline | null> {
  try {
    const res = await fetch(`${API_URL}/batches/${id}/timeline`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as BatchTimeline;
  } catch {
    return null;
  }
}
