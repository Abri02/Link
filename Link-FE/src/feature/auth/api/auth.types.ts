export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MeResponse {
  id: number;
  email: string;
  username: string;
}

export interface ErrorResponse {
  message: string;
}
