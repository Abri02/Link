import { useAuthStore } from "@/feature/auth/stores/authStore";
import { useWorkspaceStore } from "@/feature/workspace/stores/workspaceStore";
import { useConversations } from "@/feature/channel/hooks/useConversations";
import { useChannelMembers } from "@/feature/channel/hooks/useChannelMembership";

/**
 * People who can be @mentioned in this channel or conversation: its members except the current
 * user. The backend ignores mentions of anyone else.
 */
export function useMentionCandidates(channelId: number) {
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const me = useAuthStore((s) => s.user?.id);
  const { data: conversations } = useConversations(workspaceId);
  const conversation = conversations?.find((c) => c.id === channelId);
  // DMs have no members endpoint; their members come with the conversation list.
  const { data: channelMembers } = useChannelMembers(channelId, conversations != null && !conversation);
  const members = conversation?.members ?? channelMembers ?? [];
  return members.filter((m) => m.userId !== me);
}
