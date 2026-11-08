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
    <Center minH="100vh" bg="bg" flexDirection="column" gap="3">
      <Text color="fg" textStyle="title">
        {user?.username ?? ""}
      </Text>
      <Button
        variant="outline"
        onClick={() => logout(undefined, { onSuccess: () => navigate("/login") })}
        loading={isPending}
      >
        <LogOut size={14} />
        Log out
      </Button>
    </Center>
  );
}
