import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";
import type { LoginRequest } from "../api/auth.types";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: authKeys.login(),
    mutationFn: (payload: LoginRequest) => login(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};
