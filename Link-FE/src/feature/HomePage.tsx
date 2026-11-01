import { useNavigate } from "react-router-dom";
import { Button, Center, Text } from "@chakra-ui/react";
import { LogOut } from "lucide-react";
import { useLogout } from "@/feature/auth/hooks/useLogout";
import { useAuthStore } from "@/feature/auth/stores/authStore";

export function HomePage() {
  const navigate = useNavigate();
  const { mutate: logout, isPending } = useLogout();
  const user = useAuthStore((s) => s.user);

  return (
    <Center minH="100vh" bg="#1C1C2E" flexDirection="column" gap="12px">
      <Text color="#F4F4F6" fontSize="lg" fontWeight="600">
        {user?.username ?? ""}
      </Text>
      <Button
        onClick={() => logout(undefined, { onSuccess: () => navigate("/login") })}
        loading={isPending}
        height="40px"
        px="20px"
        background="transparent"
        border="1px solid #2E2E50"
        color="rgba(244,244,246,0.6)"
        fontSize="13px"
        borderRadius="8px"
        _hover={{ borderColor: "#3B3350", color: "#F4F4F6" }}
      >
        <LogOut size={14} style={{ marginRight: "8px" }} />
        Log out
      </Button>
    </Center>
  );
}
