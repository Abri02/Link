import { Box, HStack, Text, IconButton } from "@chakra-ui/react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/feature/auth/hooks/useLogout";
import { useAuthStore } from "@/feature/auth/stores/authStore";

export function SidebarFooter() {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const user = useAuthStore((s) => s.user);

  return (
    <Box px="12px" py="10px" borderTop="1px solid #16161F">
      <HStack justify="space-between">
        <Text color="rgba(244,244,246,0.6)" fontSize="13px" truncate>
          {user?.username}
        </Text>
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
