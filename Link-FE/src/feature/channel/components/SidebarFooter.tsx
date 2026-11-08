import { Box, HStack, Text } from "@chakra-ui/react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { SidebarAction } from "@/components/ui/SidebarAction";
import { useLogout } from "@/feature/auth/hooks/useLogout";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";

export function SidebarFooter() {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const user = useAuthStore((s) => s.user);
  const isOnline = usePresenceStore((s) => user != null && s.onlineIds.has(user.id));

  return (
    <Box px="3" py="2.5" borderTopWidth="1px" borderColor="sidebar.border">
      <HStack justify="space-between">
        <HStack gap="1.5" minW="0">
          <PresenceDot online={isOnline} />
          <Text color="sidebar.muted" textStyle="label" truncate>
            {user?.username}
          </Text>
        </HStack>
        <SidebarAction label="Log out" onClick={() => logout(undefined, { onSuccess: () => navigate("/login") })}>
          <LogOut size={14} />
        </SidebarAction>
      </HStack>
    </Box>
  );
}
