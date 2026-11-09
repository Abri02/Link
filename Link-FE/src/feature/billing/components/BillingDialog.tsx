import { HStack, Link, Spinner, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FormError } from "@/components/ui/FormError";
import { useSubscription } from "../hooks/useSubscription";
import { BillingActionButton } from "./BillingActionButton";

interface Props {
  workspaceId: number;
}

export function BillingDialog({ workspaceId }: Props) {
  const { data: subscription, error } = useSubscription(workspaceId);

  if (error) return <FormError>{error.message}</FormError>;
  if (!subscription) return <Spinner size="sm" color="brand.solid" />;

  const isPremium = subscription.plan === "PREMIUM";
  return (
    <VStack gap="4" alignItems="stretch">
      <HStack justify="space-between">
        <Text textStyle="label" color="fg.muted">Current plan</Text>
        <Text textStyle="label" data-testid="current-plan">
          {isPremium ? "Premium" : "Free"}
        </Text>
      </HStack>
      {isPremium && subscription.currentPeriodEnd && (
        <HStack justify="space-between">
          <Text textStyle="label" color="fg.muted">Current period ends</Text>
          <Text textStyle="label">
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </Text>
        </HStack>
      )}
      <BillingActionButton subscription={subscription} />
      <Link asChild textStyle="caption" alignSelf="center">
        <RouterLink to={`/pricing?workspaceId=${workspaceId}`}>Compare plans</RouterLink>
      </Link>
    </VStack>
  );
}
