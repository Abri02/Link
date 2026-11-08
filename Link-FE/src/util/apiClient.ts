import { API_URL } from "./constants";

/** Double-submit CSRF header, built from the cookie the gateway sets. */
export const csrfHeaders = (): Record<string, string> => {
  const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1];
  return token ? { 'X-XSRF-TOKEN': token } : {};
};

/** A failed request. `code` is the backend's machine-readable reason, when it sent one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** True when the request was refused because of the workspace's plan. */
export const isPlanLimitError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 402;

/** Builds the error for a failed response, using its JSON `{ message, code }` body if it has one. */
export const toApiError = async (response: Response): Promise<ApiError> => {
  const fallback = `Request failed with status ${response.status}`;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return new ApiError(fallback, response.status);
  }
  const body = await response.json().catch(() => ({}));
  return new ApiError(body?.message ?? fallback, response.status, body?.code);
};

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders(), ...options.headers },
  });

  if (response.status === 401) {
    if (!window.location.pathname.match(/^\/(login|signup)/)) {
      window.location.href = "/login";
      return;
    }
    throw new Error("Invalid email or password");
  }

  if (!response.ok) throw await toApiError(response);
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) return;
  return response.json();
};