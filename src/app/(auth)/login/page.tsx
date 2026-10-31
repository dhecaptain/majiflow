import { AuthShell, LoginForm } from "@/components/marketing/auth";

export const metadata = { title: "Sign in" };

export default function Login() {
  return (
    <AuthShell
      mode="login"
      subtitle="Track your refills, reorder your favourites and manage your delivery details."
    >
      <LoginForm />
    </AuthShell>
  );
}