import { useMutation } from "@tanstack/react-query";
import { logout } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";

export const useLogout = () => {
  return useMutation({
    mutationKey: authKeys.logout(),
    mutationFn: logout,
  });
};
