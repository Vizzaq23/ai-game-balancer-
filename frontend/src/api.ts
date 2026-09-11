export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(
      "Unable to reach the analysis service. Check your connection and try again.",
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "The service returned an unexpected response. Please try again shortly.",
    );
  }
  if (!response.ok || body.errors?.length)
    throw new Error(
      body.errors?.join("\n") || "The request failed. Please try again.",
    );
  return body.data as T;
}
export function post(data: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
