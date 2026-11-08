import { API_URL } from "./constants";

/** Double-submit CSRF header, built from the cookie the gateway sets. */
export const csrfHeaders = (): Record<string, string> => {
  const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1];
  return token ? { 'X-XSRF-TOKEN': token } : {};
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

  if (!response.ok) {
    const ct = response.headers.get("content-type");
    if (ct?.includes("application/json")) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message ?? `Request failed with status ${response.status}`);
    }
    throw new Error(`Request failed with status ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) return;
  return response.json();
};