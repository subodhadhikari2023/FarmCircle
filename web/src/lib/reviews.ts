import { API_URL, apiFetch } from "./api";

export type Review = {
  id: string;
  reviewerId: string;
  growerId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  // Included by GET /reviews (ReviewsService.findAll) only, not GET /reviews/:id.
  reviewer?: { name: string };
};

export type CreateReviewInput = {
  orderId: string;
  rating: number;
  comment?: string;
};

export function createReview(
  accessToken: string,
  input: CreateReviewInput,
): Promise<Review> {
  return apiFetch<Review>("/reviews", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Public — same list Admin moderates from. Already excludes isHidden rows
// server-side, so there's no way (via this endpoint) to review or unhide
// something once it's been hidden.
export async function listReviews(): Promise<Review[]> {
  try {
    const res = await fetch(`${API_URL}/reviews`);
    if (!res.ok) return [];
    return (await res.json()) as Review[];
  } catch {
    return [];
  }
}

// Admin-only. One-way takedown — no unhide endpoint exists.
export function hideReview(accessToken: string, id: string): Promise<Review> {
  return apiFetch<Review>(`/reviews/${id}/hide`, accessToken, {
    method: "PATCH",
  });
}
