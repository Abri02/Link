import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { me } from "../api/auth.api";
import { authKeys } from "../api/auth.api.keys";
import { useAuthStore } from "../stores/authStore";

export const useMe = (enabled = true) => {
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  const query = useQuery({
    queryKey: authKeys.me(),
    queryFn: me,
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
    if (query.error) clearUser();
  }, [query.data, query.error, setUser, clearUser]);

  return query;
};
