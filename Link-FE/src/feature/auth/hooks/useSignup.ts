import { useMutation } from "@tanstack/react-query";
import { signup } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";
import type { SignupRequest } from "../api/auth.types";

export const useSignup = () => {
  return useMutation({
    mutationKey: authKeys.signup(),
    mutationFn: (payload: SignupRequest) => signup(payload),
  });
};
