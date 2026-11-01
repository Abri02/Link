import { Button, Flex, Text } from "@chakra-ui/react";
import { useLogin } from "../hooks/useLogin";
import type { LoginRequest } from "../api/auth.types";

export function LoginBox() {
  const { mutate: login } = useLogin();
  const loginRequest: LoginRequest = {
    email: "teszt@gmail.com",
    password: "teszt2",
  };

  return (
    <Flex direction="column" gap="8px">
      <Text>Login</Text>
      <Button
        onClick={() => {
          login(loginRequest);
        }}
      >
        Login
      </Button>
    </Flex>
  );
}
