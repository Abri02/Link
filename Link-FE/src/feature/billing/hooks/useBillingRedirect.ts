import { useMutation } from "@tanstack/react-query";
import { createCheckoutSession, createPortalSession } from "../api/billing.api";

/** Asks the backend for a Stripe page (Checkout or the customer portal) and sends the browser there. */
export function useBillingRedirect(workspaceId: number, target: "checkout" | "portal") {
  return useMutation({
    mutationFn: () => (target === "checkout" ? createCheckoutSession(workspaceId) : createPortalSession(workspaceId)),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
