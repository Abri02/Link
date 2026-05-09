import { Navigate } from "react-router-dom";
import { useMe } from "@/feature/auth/hooks/useMe";

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useMe();

  if (isLoading) return null;
  if (data) return <Navigate to="/" replace />;

  return <>{children}</>;
}
