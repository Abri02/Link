export type Plan = "FREE" | "PREMIUM";

export interface Subscription {
  workspaceId: number;
  plan: Plan;
  /** Stripe's raw status, or null when the workspace never subscribed. */
  status: string | null;
  currentPeriodEnd: string | null;
}

export interface BillingSession {
  url: string;
}
