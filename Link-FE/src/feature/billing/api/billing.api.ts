import { apiClient } from "@/util/apiClient";
import type { BillingSession, Subscription } from "./billing.types";

export const getSubscription = (workspaceId: number): Promise<Subscription> =>
  apiClient(`/payments/subscription?workspaceId=${workspaceId}`);

export const createCheckoutSession = (workspaceId: number): Promise<BillingSession> =>
  apiClient("/payments/checkout-session", { method: "POST", body: JSON.stringify({ workspaceId }) });

export const createPortalSession = (workspaceId: number): Promise<BillingSession> =>
  apiClient("/payments/portal-session", { method: "POST", body: JSON.stringify({ workspaceId }) });
