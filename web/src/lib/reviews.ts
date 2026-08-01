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

// Public — the list Admin moderates from. Excludes isHidden rows
// server-side; see listHiddenReviews for those.
export async function listReviews(): Promise<Review[]> {
  try {
    const res = await fetch(`${API_URL}/reviews`);
    if (!res.ok) return [];
    return (await res.json()) as Review[];
  } catch {
    return [];
  }
}

// Admin-only.
export function hideReview(accessToken: string, id: string): Promise<Review> {
  return apiFetch<Review>(`/reviews/${id}/hide`, accessToken, {
    method: "PATCH",
  });
}

// Admin-only. The only way to see a review after it's been hidden — GET
// /reviews and GET /reviews/:id both exclude isHidden rows unconditionally.
export function listHiddenReviews(accessToken: string): Promise<Review[]> {
  return apiFetch<Review[]>("/reviews/hidden", accessToken);
}

export function unhideReview(
  accessToken: string,
  id: string,
): Promise<Review> {
  return apiFetch<Review>(`/reviews/${id}/unhide`, accessToken, {
    method: "PATCH",
  });
}
