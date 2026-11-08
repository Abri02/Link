import { HStack, Text } from "@chakra-ui/react";
import { CreditCard, LogOut, UserPlus } from "lucide-react";
import { Tip } from "@/components/Tip";
import { SidebarAction } from "@/components/ui/SidebarAction";
import { PremiumBadge } from "@/feature/billing/components/PremiumBadge";
import { useSubscription } from "@/feature/billing/hooks/useSubscription";
import { useLeaveWorkspace } from "@/feature/workspace/hooks/useLeaveWorkspace";
import { useMyWorkspaceRole } from "@/feature/workspace/hooks/useMyWorkspaceRole";
import { useWorkspaces } from "@/feature/workspace/hooks/useWorkspaces";

interface Props {
  workspaceId: number;
  onBillingClick: () => void;
  onInviteClick: () => void;
}

export function ChannelSidebarHeader({ workspaceId, onBillingClick, onInviteClick }: Props) {
  const { data: workspaces } = useWorkspaces();
  const { data: subscription } = useSubscription(workspaceId);
  const role = useMyWorkspaceRole(workspaceId);
  const leaveWorkspace = useLeaveWorkspace(workspaceId);
  const workspace = workspaces?.find((w) => w.id === workspaceId);

  return (
    <>
      <HStack px="4" py="3" borderBottomWidth="1px" borderColor="sidebar.border" justify="space-between">
        <HStack gap="1.5" minW="0">
          <Text color="sidebar.fg" textStyle="body" fontWeight="600" truncate>
            {workspace?.name ?? ""}
          </Text>
          {subscription?.plan === "PREMIUM" && <PremiumBadge />}
        </HStack>
        <HStack gap="0.5" flexShrink={0}>
          {role === "OWNER" && (
            <Tip label="Billing">
              <SidebarAction label="Billing" onClick={onBillingClick}>
                <CreditCard size={14} />
              </SidebarAction>
            </Tip>
          )}
          {(role === "OWNER" || role === "ADMIN") && (
            <Tip label="Invite member">
              <SidebarAction label="Invite member" onClick={onInviteClick}>
                <UserPlus size={14} />
              </SidebarAction>
            </Tip>
          )}
          <Tip label="Leave workspace">
            <SidebarAction
              label="Leave workspace"
              onClick={() => {
                if (window.confirm(`Leave ${workspace?.name ?? "this workspace"}?`)) leaveWorkspace.mutate();
              }}
            >
              <LogOut size={14} />
            </SidebarAction>
          </Tip>
        </HStack>
      </HStack>
      {leaveWorkspace.error && (
        <Text color="sidebar.fg" textStyle="caption" px="4" pt="1.5" role="alert">
          {leaveWorkspace.error.message}
        </Text>
      )}
    </>
  );
}
