export const billingKeys = {
  subscription: (workspaceId: number) => ["billing", workspaceId, "subscription"] as const,
};
