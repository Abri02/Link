import { Box, Center } from "@chakra-ui/react";
import { LoginBrandPanel } from "../components/LoginBrandPanel";
import { RegisterForm } from "../components/RegisterForm";

export function RegisterPage() {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", md: "44% 56%" }}
      minH="100vh"
      bg="#0A0A10"
    >
      <LoginBrandPanel />
      <Center p={{ base: "48px 24px", md: "52px" }} bg="#0A0A10">
        <Box className="link-form-enter" width="100%" display="flex" justifyContent="center">
          <RegisterForm />
        </Box>
      </Center>
    </Box>
  );
}
