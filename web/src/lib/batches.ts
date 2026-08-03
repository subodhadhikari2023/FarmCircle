import { API_URL } from "./api";

export type BatchTimelineMilestone = {
  name: string;
  order: number;
  expectedDurationDays: number;
  reachedAt: string | null;
};

export type BatchTimeline = {
  batchId: string;
  milestones: BatchTimelineMilestone[];
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
