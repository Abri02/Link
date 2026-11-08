import { AuthLayout } from "../components/AuthLayout";
import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your workspace.">
      <LoginForm />
    </AuthLayout>
  );
}
