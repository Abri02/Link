import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addConversationMembers, leaveConversation, renameConversation } from "../api/channel.api";
import { channelKeys } from "../api/channel.api.keys";

export function useAddConversationMembers(workspaceId: number, conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) => addConversationMembers(conversationId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.conversations(workspaceId) });
    },
  });
}

export function useRenameConversation(workspaceId: number, conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => renameConversation(conversationId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.conversations(workspaceId) });
    },
  });
}

export function useLeaveConversation(workspaceId: number, conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.conversations(workspaceId) });
    },
  });
}
