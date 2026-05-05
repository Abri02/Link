import { useQuery } from "@tanstack/react-query";
import { me } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";

export const useMe = (enabled = true) => {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: me,
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
