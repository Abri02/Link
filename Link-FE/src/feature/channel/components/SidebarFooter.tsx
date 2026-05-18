import { Box, HStack, Text, IconButton } from "@chakra-ui/react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/feature/auth/hooks/useLogout";
import { useAuthStore } from "@/feature/auth/stores/authStore";
import { usePresenceStore } from "@/feature/presence/stores/presenceStore";

export function SidebarFooter() {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const user = useAuthStore((s) => s.user);
  const isOnline = usePresenceStore((s) => user != null && s.onlineIds.has(user.id));

  return (
    <Box px="12px" py="10px" borderTop="1px solid #2A2A45">
      <HStack justify="space-between">
        <HStack gap="6px" minW="0">
          <Box position="relative" flexShrink={0}>
            <Box w="8px" h="8px" borderRadius="full" bg={isOnline ? "#22C55E" : "rgba(244,244,246,0.2)"} />
          </Box>
          <Text color="rgba(244,244,246,0.6)" fontSize="13px" truncate>
            {user?.username}
          </Text>
        </HStack>
        <IconButton
          size="xs"
          variant="ghost"
          color="rgba(244,244,246,0.4)"
          _hover={{ color: "#FF6B6B" }}
          aria-label="Log out"
          onClick={() => logout(undefined, { onSuccess: () => navigate("/login") })}
          h="24px"
          w="24px"
          minW="0"
        >
          <LogOut size={14} />
        </IconButton>
      </HStack>
    </Box>
  );
}
