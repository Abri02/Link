import { HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useSubscription } from "../hooks/useSubscription";
import { BillingActionButton } from "./BillingActionButton";

interface Props {
  workspaceId: number;
}

export function BillingDialog({ workspaceId }: Props) {
  const { data: subscription, error } = useSubscription(workspaceId);

  if (error) {
    return (
      <Text color="#FF6B6B" fontSize="12px" role="alert">
        {error.message}
      </Text>
    );
  }
  if (!subscription) return <Spinner size="sm" color="#6C63FF" />;

  const isPremium = subscription.plan === "PREMIUM";
  return (
    <VStack gap="16px" alignItems="stretch">
      <HStack justify="space-between">
        <Text color="rgba(244,244,246,0.7)" fontSize="13px">Current plan</Text>
        <Text color="#F4F4F6" fontSize="13px" fontWeight="600" data-testid="current-plan">
          {isPremium ? "Premium" : "Free"}
        </Text>
      </HStack>
      {isPremium && subscription.currentPeriodEnd && (
        <HStack justify="space-between">
          <Text color="rgba(244,244,246,0.7)" fontSize="13px">Current period ends</Text>
          <Text color="#F4F4F6" fontSize="13px">
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </Text>
        </HStack>
      )}
      <BillingActionButton subscription={subscription} />
      <Link
        to={`/pricing?workspaceId=${workspaceId}`}
        style={{ color: "#A8A3FF", fontSize: "12px", textAlign: "center" }}
      >
        Compare plans
      </Link>
    </VStack>
  );
}
