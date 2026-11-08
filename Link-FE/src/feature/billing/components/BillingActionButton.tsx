import { Button, Text, VStack } from "@chakra-ui/react";
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
    <VStack gap="8px" alignItems="stretch">
      <Button
        onClick={() => mutate()}
        loading={isPending}
        bg="#6C63FF"
        color="white"
        _hover={{ bg: "#5B52E0" }}
        borderRadius="8px"
        h="36px"
        fontSize="13px"
      >
        {hasSubscription ? "Manage billing" : "Upgrade to Premium"}
      </Button>
      {error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {error.message}
        </Text>
      )}
    </VStack>
  );
}
