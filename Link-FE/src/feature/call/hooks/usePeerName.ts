import { useQueryClient } from "@tanstack/react-query";
import { channelKeys } from "@/feature/channel/api/channel.api.keys";
import type { Conversation } from "@/feature/channel/api/channel.types";

/**
 * Username of the other person in a call, looked up in the cached DM lists of every workspace
 * (the call may come from a DM in a workspace that isn't selected). `null` when not cached.
 */
export function usePeerName(channelId: number | null, peerUserId: number | null): string | null {
  const queryClient = useQueryClient();
  if (channelId == null || peerUserId == null) return null;
  for (const [, data] of queryClient.getQueriesData<unknown[]>({ queryKey: channelKeys.all })) {
    if (!Array.isArray(data)) continue;
    const dm = (data as Partial<Conversation>[]).find((c) => c.id === channelId && Array.isArray(c.members));
    const peer = dm?.members?.find((m) => m.userId === peerUserId);
    if (peer) return peer.username;
  }
  return null;
}
