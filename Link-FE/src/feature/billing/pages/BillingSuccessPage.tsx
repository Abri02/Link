import { useEffect, useState } from "react";
import { Spinner, Text } from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { BillingPageLayout } from "../components/BillingPageLayout";
import { useBillingWorkspaceId } from "../hooks/useBillingWorkspaceId";
import { useSubscription } from "../hooks/useSubscription";

const CONFIRM_TIMEOUT_MS = 60_000;
const text = { color: "rgba(244,244,246,0.7)", fontSize: "14px" } as const;

/** Stripe's redirect only means Checkout finished. The plan changes when the webhook arrives. */
export function BillingSuccessPage() {
  const workspaceId = useBillingWorkspaceId();
  const [timedOut, setTimedOut] = useState(false);
  const { data: subscription, error } = useSubscription(workspaceId, !timedOut);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (workspaceId == null) return <Navigate to="/" replace />;

  const isPremium = subscription?.plan === "PREMIUM";
  return (
    <BillingPageLayout title={isPremium ? "You're on Premium" : "Thanks for your order"} workspaceId={workspaceId}>
      {error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {error.message}
        </Text>
      )}
      {isPremium && <Text {...text}>Every member of this workspace now has Premium.</Text>}
      {!error && !isPremium && !timedOut && (
        <>
          <Text {...text}>Confirming your payment…</Text>
          <Spinner size="sm" color="#6C63FF" alignSelf="center" />
        </>
      )}
      {!error && !isPremium && timedOut && (
        <Text {...text}>Your payment is still being confirmed. Premium will appear on the workspace shortly.</Text>
      )}
    </BillingPageLayout>
  );
}
