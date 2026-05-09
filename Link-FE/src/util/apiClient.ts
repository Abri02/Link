import { API_URL } from "./constants";

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (response.status === 401) {
    if (!window.location.pathname.match(/^\/(login|signup)/)) {
      window.location.href = "/login";
      return;
    }
    throw new Error("Invalid email or password");
  }

  if (!response.ok) throw new Error('Network response was not ok');
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) return;
  return response.json();
};