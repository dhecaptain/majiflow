import { AuthShell, RegisterForm } from "@/components/marketing/auth";

export const metadata = { title: "Create an account" };

export default function Register() {
  return (
    <AuthShell
      mode="register"
      subtitle="One account for ordering water, tracking deliveries and managing your saved addresses."
    >
      <RegisterForm />
    </AuthShell>
  );
}