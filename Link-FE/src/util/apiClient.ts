import { API_URL } from "./constants";

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};