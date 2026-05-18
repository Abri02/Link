import { Box, Center } from "@chakra-ui/react";
import { LoginBrandPanel } from "../components/LoginBrandPanel";
import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", md: "44% 56%" }}
      minH="100vh"
      bg="#1C1C2E"
    >
      <LoginBrandPanel />
      <Center p={{ base: "48px 24px", md: "52px" }} bg="#1C1C2E">
        <Box className="link-form-enter" width="100%" display="flex" justifyContent="center">
          <LoginForm />
        </Box>
      </Center>
    </Box>
  );
}
