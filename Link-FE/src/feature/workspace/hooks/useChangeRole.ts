import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeMemberRole } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";
import type { WorkspaceRole } from "../api/workspace.types";

export function useChangeRole(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: WorkspaceRole }) =>
      changeMemberRole(workspaceId, userId, { role }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}
