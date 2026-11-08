import { Text } from "@chakra-ui/react";
import { Link, Navigate } from "react-router-dom";
import { BillingPageLayout } from "../components/BillingPageLayout";
import { useBillingWorkspaceId } from "../hooks/useBillingWorkspaceId";

export function BillingCancelPage() {
  const workspaceId = useBillingWorkspaceId();

  if (workspaceId == null) return <Navigate to="/" replace />;

  return (
    <BillingPageLayout title="Checkout cancelled" workspaceId={workspaceId}>
      <Text color="rgba(244,244,246,0.7)" fontSize="14px">
        You weren't charged, and the workspace stays on its current plan.
      </Text>
      <Link to={`/pricing?workspaceId=${workspaceId}`} style={{ color: "#A8A3FF", fontSize: "13px", textAlign: "center" }}>
        See plans
      </Link>
    </BillingPageLayout>
  );
}
