/** The API (FastAPI), under /api/v1. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const messageOf = (answer: { detail?: unknown }, fallback: string) =>
  typeof answer?.detail === 'string' ? answer.detail : fallback;

export const errorText = (error: unknown) =>
  error instanceof ApiError && error.status >= 500
    ? 'Adnario AI could not be reached: the API server is not running.'
    : error instanceof Error
      ? error.message
      : String(error);

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, init);
  if (!response.ok) throw new ApiError(messageOf(await response.json().catch(() => ({})), response.statusText), response.status);
  return response.status === 204 ? (undefined as T) : response.json();
}
