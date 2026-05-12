import { useQuery } from "@tanstack/react-query";
import { listMembers } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";

export function useWorkspaceMembers(workspaceId: number | null) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId!),
    queryFn: () => listMembers(workspaceId!),
    enabled: workspaceId != null,
  });
}
