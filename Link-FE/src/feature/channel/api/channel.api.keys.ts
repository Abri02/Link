export const channelKeys = {
  all: ["channels"] as const,
  byWorkspace: (workspaceId: number) => [...channelKeys.all, workspaceId] as const,
  conversations: (workspaceId: number) => [...channelKeys.all, workspaceId, "dms"] as const,
};
