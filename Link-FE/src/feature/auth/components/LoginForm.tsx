import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Button, Link, Text, VStack } from "@chakra-ui/react";
import { FormError } from "../../../components/ui/FormError";
import { TextField } from "../../../components/ui/TextField";
import { useLogin } from "../hooks/useLogin";
import { PasswordField } from "./PasswordField";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: login, isPending, error } = useLogin();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    login({ email, password }, { onSuccess: () => navigate("/") });
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap="4" align="stretch">
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <FormError>{error.message || "Invalid email or password"}</FormError>}
        <Button type="submit" loading={isPending} w="full">
          Sign in
        </Button>
        <Text textStyle="label" color="fg.muted" textAlign="center">
          Don't have an account?{" "}
          <Link asChild>
            <RouterLink to="/signup">Create one</RouterLink>
          </Link>
        </Text>
      </VStack>
    </form>
  );
}
