import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { removeMember } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";
import { useWorkspaceStore } from "../stores/workspaceStore";

export function useLeaveWorkspace(workspaceId: number) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  return useMutation({
    mutationFn: () => removeMember(workspaceId, currentUserId!),
    onSuccess: () => {
      selectWorkspace(null);
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(workspaceId) });
      return queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}
