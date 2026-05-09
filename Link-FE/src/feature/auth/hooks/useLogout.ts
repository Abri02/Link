import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";
import { useAuthStore } from "../stores/authStore";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((s) => s.clearUser);

  return useMutation({
    mutationKey: authKeys.logout(),
    mutationFn: logout,
    onSuccess: () => {
      clearUser();
      queryClient.removeQueries({ queryKey: authKeys.me() });
    },
  });
};
