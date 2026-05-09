export const channelKeys = {
  all: ["channels"] as const,
  byWorkspace: (workspaceId: number) => [...channelKeys.all, workspaceId] as const,
};
