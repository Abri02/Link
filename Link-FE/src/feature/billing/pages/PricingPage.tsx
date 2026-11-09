import { Spinner, Table, Text } from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { FormError } from "@/components/ui/FormError";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { BillingActionButton } from "../components/BillingActionButton";
import { BillingPageLayout } from "../components/BillingPageLayout";
import { useBillingWorkspaceId } from "../hooks/useBillingWorkspaceId";
import { useSubscription } from "../hooks/useSubscription";

// Same limits as README §3.7, enforced by messaging-service and file-service.
const FEATURES = [
  { name: "Workspaces, channels, DMs, threads", free: "Included", premium: "Included" },
  { name: "Video calls", free: "Not included", premium: "Included" },
  { name: "Max upload size per file", free: "5 MB", premium: "20 MB" },
  { name: "Guests per workspace", free: "Up to 3", premium: "Unlimited" },
  { name: "Message history", free: "Last 90 days", premium: "Full" },
];

export function PricingPage() {
  const workspaceId = useBillingWorkspaceId();
  const { data: subscription, error } = useSubscription(workspaceId);
  const role = useMyWorkspaceRole(workspaceId);

  if (workspaceId == null) return <Navigate to="/" replace />;

  return (
    <BillingPageLayout title="Plans" workspaceId={workspaceId}>
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Feature</Table.ColumnHeader>
            <Table.ColumnHeader>Free</Table.ColumnHeader>
            <Table.ColumnHeader>Premium</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {FEATURES.map((f) => (
            <Table.Row key={f.name}>
              <Table.Cell>{f.name}</Table.Cell>
              <Table.Cell>{f.free}</Table.Cell>
              <Table.Cell>{f.premium}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {error && <FormError>{error.message}</FormError>}
      {!error && (!subscription || !role) && <Spinner size="sm" color="brand.solid" alignSelf="center" />}
      {subscription && role === "OWNER" && <BillingActionButton subscription={subscription} />}
      {subscription && role && role !== "OWNER" && (
        <Text textStyle="label" color="fg.muted" textAlign="center">
          {subscription.plan === "PREMIUM"
            ? "This workspace is on Premium."
            : "Only the workspace owner can upgrade this workspace."}
        </Text>
      )}
    </BillingPageLayout>
  );
}
