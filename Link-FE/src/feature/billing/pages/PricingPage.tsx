import { Spinner, Table, Text } from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
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

const headerCell = { color: "rgba(244,244,246,0.5)", fontSize: "12px", bg: "transparent", borderColor: "#2E2E50" };
const bodyCell = { color: "#F4F4F6", fontSize: "13px", bg: "transparent", borderColor: "#2E2E50" };

export function PricingPage() {
  const workspaceId = useBillingWorkspaceId();
  const { data: subscription, error } = useSubscription(workspaceId);
  const role = useMyWorkspaceRole(workspaceId);

  if (workspaceId == null) return <Navigate to="/" replace />;

  return (
    <BillingPageLayout title="Plans" workspaceId={workspaceId}>
      <Table.Root size="sm" bg="transparent">
        <Table.Header>
          <Table.Row bg="transparent">
            <Table.ColumnHeader {...headerCell}>Feature</Table.ColumnHeader>
            <Table.ColumnHeader {...headerCell}>Free</Table.ColumnHeader>
            <Table.ColumnHeader {...headerCell}>Premium</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {FEATURES.map((f) => (
            <Table.Row key={f.name} bg="transparent">
              <Table.Cell {...bodyCell}>{f.name}</Table.Cell>
              <Table.Cell {...bodyCell}>{f.free}</Table.Cell>
              <Table.Cell {...bodyCell}>{f.premium}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {error && (
        <Text color="#FF6B6B" fontSize="12px" role="alert">
          {error.message}
        </Text>
      )}
      {!error && (!subscription || !role) && <Spinner size="sm" color="#6C63FF" alignSelf="center" />}
      {subscription && role === "OWNER" && <BillingActionButton subscription={subscription} />}
      {subscription && role && role !== "OWNER" && (
        <Text color="rgba(244,244,246,0.7)" fontSize="13px" textAlign="center">
          {subscription.plan === "PREMIUM"
            ? "This workspace is on Premium."
            : "Only the workspace owner can upgrade this workspace."}
        </Text>
      )}
    </BillingPageLayout>
  );
}
