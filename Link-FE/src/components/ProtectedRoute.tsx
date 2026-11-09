import { Navigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { useMe } from "@/feature/auth/hooks/useMe";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data, isLoading, error } = useMe();

  if (isLoading) {
    return <Box minH="100vh" bg="bg" />;
  }

  if (error || !data) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
