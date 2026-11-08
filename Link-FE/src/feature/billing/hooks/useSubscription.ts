import { useQuery } from "@tanstack/react-query";
import { getSubscription } from "../api/billing.api";
import { billingKeys } from "../api/billing.api.keys";

const POLL_MS = 2_000;

/** With `pollUntilPremium` it keeps refetching, because the Stripe webhook can arrive after the redirect. */
export function useSubscription(workspaceId: number | null, pollUntilPremium = false) {
  return useQuery({
    queryKey: billingKeys.subscription(workspaceId!),
    queryFn: () => getSubscription(workspaceId!),
    enabled: workspaceId != null,
    refetchInterval: (query) => (pollUntilPremium && query.state.data?.plan !== "PREMIUM" ? POLL_MS : false),
  });
}
