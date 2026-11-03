import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMember } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";

export function useRemoveMember(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => removeMember(workspaceId, userId),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}
