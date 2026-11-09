import { Link, Text } from "@chakra-ui/react";
import { Link as RouterLink, Navigate } from "react-router-dom";
import { BillingPageLayout } from "../components/BillingPageLayout";
import { useBillingWorkspaceId } from "../hooks/useBillingWorkspaceId";

export function BillingCancelPage() {
  const workspaceId = useBillingWorkspaceId();

  if (workspaceId == null) return <Navigate to="/" replace />;

  return (
    <BillingPageLayout title="Checkout cancelled" workspaceId={workspaceId}>
      <Text textStyle="body" color="fg.muted">
        You weren't charged, and the workspace stays on its current plan.
      </Text>
      <Link asChild textStyle="label" alignSelf="center">
        <RouterLink to={`/pricing?workspaceId=${workspaceId}`}>See plans</RouterLink>
      </Link>
    </BillingPageLayout>
  );
}
