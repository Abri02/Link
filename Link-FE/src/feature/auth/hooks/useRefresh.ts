import { useMutation } from "@tanstack/react-query";
import { refresh } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";

export const useRefresh = () => {
  return useMutation({
    mutationKey: authKeys.refresh(),
    mutationFn: refresh,
  });
};
