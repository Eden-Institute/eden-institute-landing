import { AuthForm } from "@/components/apothecary/AuthForm";

export default function SignUp() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-6">
      <div
        className="max-w-md w-full rounded-lg p-8 shadow-sm border bg-background"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
