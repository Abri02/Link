import { Button, VStack } from "@chakra-ui/react";
import { FormError } from "@/components/ui/FormError";
import type { Subscription } from "../api/billing.types";
import { useBillingRedirect } from "../hooks/useBillingRedirect";

/** Statuses without Premium where Stripe still holds a subscription, so the backend refuses a new Checkout. */
const UNPAID_STATUSES = ["past_due", "unpaid"];

interface Props {
  subscription: Subscription;
}

/** Upgrade button, or "Manage billing" when the workspace already has a subscription. Owners only. */
export function BillingActionButton({ subscription }: Props) {
  const hasSubscription =
    subscription.plan === "PREMIUM" || UNPAID_STATUSES.includes(subscription.status ?? "");
  const { mutate, isPending, error } = useBillingRedirect(
    subscription.workspaceId,
    hasSubscription ? "portal" : "checkout"
  );

  return (
    <VStack gap="2" alignItems="stretch">
      <Button onClick={() => mutate()} loading={isPending}>
        {hasSubscription ? "Manage billing" : "Upgrade to Premium"}
      </Button>
      {error && <FormError>{error.message}</FormError>}
    </VStack>
  );
}
