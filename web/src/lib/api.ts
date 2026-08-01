export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // response wasn't JSON — fall through to the generic message
  }
  return "Something went wrong. Please try again.";
}

// For authenticated mutations/reads against Grower/Vendor/Customer-owned
// resources. Access tokens live only in memory (see auth-context.tsx), so
// this is always called from Client Components with a token from useAuth().
export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(
      "Can't reach the server. Check your connection and try again.",
    );
  }

  if (!res.ok) throw new Error(await parseApiError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
