import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";

const schema = z.object({
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});
type Values = z.infer<typeof schema>;

/**
 * Handles both (a) the forgot-password recovery flow — user arrives here after
 * clicking the email link, Supabase has injected a recovery session, AuthContext
 * navigated us here from the PASSWORD_RECOVERY event — and (b) a signed-in
 * user choosing to change their password via /apothecary/auth/update-password.
 *
 * Requires a session. Unauthenticated visitors are redirected to signin.
 */
export default function UpdatePassword() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/apothecary/auth/signin", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) return <PageSkeleton />;

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;
      toast.success("Password updated.");
      navigate("/apothecary", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-6">
      <div
        className="max-w-md w-full rounded-lg p-8 shadow-sm border bg-background"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="text-center">
            <h1
              className="font-serif text-3xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Set a new password
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-2">
              Choose a password of at least 8 characters.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button
            type="submit"
            variant="eden"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "Please wait…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
