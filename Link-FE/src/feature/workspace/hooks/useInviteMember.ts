import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inviteMember } from "../api/workspace.api";
import { workspaceKeys } from "../api/workspace.api.keys";
import type { InviteMemberRequest } from "../api/workspace.types";

export function useInviteMember(workspaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteMemberRequest) => inviteMember(workspaceId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}
