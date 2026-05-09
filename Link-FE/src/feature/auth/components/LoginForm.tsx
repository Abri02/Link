import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Text, VStack } from "@chakra-ui/react";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { useLogin } from "../hooks/useLogin";
import { LoginFormField } from "./LoginFormField";

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
    <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "380px" }}>
      <VStack gap="26px" align="stretch">
        <Box>
          <Text
            fontSize="26px"
            fontWeight="800"
            color="#F4F4F6"
            letterSpacing="-0.025em"
            lineHeight="1.15"
            mb="7px"
          >
            Welcome back
          </Text>
          <Text
            fontSize="13.5px"
            color="rgba(244,244,246,0.33)"
            letterSpacing="0.01em"
          >
            Sign in to your workspace
          </Text>
        </Box>

        <VStack gap="13px">
          <LoginFormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            icon={Mail}
            autoComplete="email"
          />
          <LoginFormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={Lock}
            autoComplete="current-password"
          />
        </VStack>

        <Box textAlign="right" mt="-10px">
          <Text
            as="a"
            fontSize="12.5px"
            color="#3B82F6"
            fontWeight="500"
            _hover={{ color: "#60A5FA" }}
          >
            Forgot password?
          </Text>
        </Box>

        {error && (
          <Box
            bg="rgba(248,113,113,0.07)"
            border="1px solid rgba(248,113,113,0.22)"
            borderRadius="8px"
            p="11px 14px"
            display="flex"
            alignItems="center"
            gap="10px"
          >
            <AlertCircle size={14} color="#F87171" style={{ flexShrink: 0 }} />
            <Text fontSize="13px" color="#F87171">
              {error.message || "Invalid email or password"}
            </Text>
          </Box>
        )}

        <Button
          type="submit"
          loading={isPending}
          width="100%"
          height="46px"
          background="#3B82F6"
          color="white"
          fontWeight="600"
          fontSize="14px"
          borderRadius="9px"
          border="none"
          letterSpacing="0.01em"
          _hover={{ background: "#2563EB" }}
          _active={{ background: "#1D4ED8" }}
        >
          Sign in →
        </Button>

        <Text fontSize="13px" color="rgba(244,244,246,0.28)" textAlign="center">
          Don't have an account?{" "}
          <Text
            as="a"
            href="/signup"
            color="#3B82F6"
            fontWeight="600"
            _hover={{ color: "#60A5FA" }}
          >
            Create one
          </Text>
        </Text>
      </VStack>
    </form>
  );
}
