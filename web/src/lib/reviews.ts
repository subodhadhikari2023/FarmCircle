import { apiFetch } from "./api";

export type Review = {
  id: string;
  reviewerId: string;
  growerId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
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
