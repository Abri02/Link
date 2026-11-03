export const channelKeys = {
  all: ["channels"] as const,
  byWorkspace: (workspaceId: number) => [...channelKeys.all, workspaceId] as const,
  /** Public channels the user hasn't joined. Under `byWorkspace`, so invalidating that refreshes it too. */
  browse: (workspaceId: number) => [...channelKeys.all, workspaceId, "browse"] as const,
  members: (channelId: number) => [...channelKeys.all, "members", channelId] as const,
  conversations: (workspaceId: number) => [...channelKeys.all, workspaceId, "dms"] as const,
};
