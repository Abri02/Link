import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Button, Link, Text, VStack } from "@chakra-ui/react";
import { FormError } from "../../../components/ui/FormError";
import { TextField } from "../../../components/ui/TextField";
import { useSignup } from "../hooks/useSignup";
import { PasswordField } from "./PasswordField";

export function RegisterForm() {
  const [fields, setFields] = useState({ displayName: "", username: "", email: "", password: "" });
  const { mutate: signup, isPending, error } = useSignup();
  const navigate = useNavigate();

  const bind = (name: keyof typeof fields) => ({
    value: fields[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [name]: e.target.value }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { displayName, username, email, password } = fields;
    if (!email || !username || !password) return;
    signup({ email, username, password, displayName: displayName || undefined }, { onSuccess: () => navigate("/") });
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap="4" align="stretch">
        <TextField label="Display name" {...bind("displayName")} placeholder="Jane Smith" autoComplete="name" />
        <TextField label="Username" {...bind("username")} placeholder="janesmith" autoComplete="username" />
        <TextField label="Email" type="email" {...bind("email")} placeholder="you@example.com" autoComplete="email" />
        <PasswordField {...bind("password")} autoComplete="new-password" />
        {error && <FormError>{error.message || "Something went wrong. Please try again."}</FormError>}
        <Button type="submit" loading={isPending} w="full">
          Create account
        </Button>
        <Text textStyle="label" color="fg.muted" textAlign="center">
          Already have an account?{" "}
          <Link asChild>
            <RouterLink to="/login">Sign in</RouterLink>
          </Link>
        </Text>
      </VStack>
    </form>
  );
}
