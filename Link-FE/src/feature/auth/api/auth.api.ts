import { apiClient } from '@/util/apiClient';
import type { SignupRequest, LoginRequest, MeResponse } from './auth.types';

export const signup = (data: SignupRequest): Promise<void> =>
  apiClient('/auth/signup', { method: 'POST', body: JSON.stringify(data) });

export const login = (data: LoginRequest): Promise<void> =>
  apiClient('/auth/login', { method: 'POST', body: JSON.stringify(data) });

export const me = (): Promise<MeResponse> =>
  apiClient('/auth/me');

export const refresh = (): Promise<void> =>
  apiClient('/auth/refresh', { method: 'POST' });

export const logout = (): Promise<void> =>
  apiClient('/auth/logout', { method: 'POST' });


