import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ROUTES } from "@/lib/routes";

export type AuthMode = "signup" | "signin" | "reset";

const emailSchema = z.string().email({
  message: "Enter a valid email address",
});
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" });

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Enter your password" }),
});

const resetSchema = z.object({ email: emailSchema });

interface FormValues {
  email: string;
  password?: string;
}

interface Props {
  mode: AuthMode;
}

/**
 * Shared form component used by SignUp, SignIn, and Reset pages. Delegates to
 * supabase.auth.signUp / signInWithPassword / resetPasswordForEmail. The
 * emailRedirectTo and redirectTo URLs point at /apothecary/auth/update-password
 * so the PASSWORD_RECOVERY flow lands on the set-new-password form.
 *
 * Post-signup routing (Stage 6.3.4):
 * - Email confirmation flow (default Supabase config): emailRedirectTo points
 *   at /apothecary/welcome-tour, so first-time users land on the onboarding
 *   tour after clicking the confirmation link.
 * - Immediate-session flow (email confirmation off): if no return_to is set,
 *   route to /apothecary/welcome-tour. If return_to is present, honor it —
 *   the user came in with intent (e.g., started from a deep link or a paid
 *   tier card) and the welcome tour can be revisited later.
 *
 * AuthContext listens for the PASSWORD_RECOVERY event and handles navigation;
 * redirectTo here just needs to be an allowed URL in Supabase Auth settings.
 */
export function AuthForm({ mode }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnToParam = params.get("return_to");
  const signinReturnTo = returnToParam ?? ROUTES.APOTHECARY;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const schema =
    mode === "signup"
      ? signupSchema
      : mode === "signin"
        ? signinSchema
        : resetSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema as unknown as z.ZodType<FormValues>),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password ?? "",
          options: {
            emailRedirectTo: `${window.location.origin}${ROUTES.APOTHECARY_WELCOME_TOUR}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome — you're signed in.");
          // Honor explicit intent (deep link or paid-tier card with
          // return_to=/apothecary/pricing); otherwise route first-time
          // signups through the welcome tour.
          const target = returnToParam ?? ROUTES.APOTHECARY_WELCOME_TOUR;
          navigate(target, { replace: true });
        } else {
          setSubmitted(true);
          toast.success("Check your email to confirm your account.");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password ?? "",
        });
        if (error) throw error;
        toast.success("Signed in.");
        navigate(signinReturnTo, { replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          values.email,
          {
            redirectTo: `${window.location.origin}${ROUTES.APOTHECARY_UPDATE_PASSWORD}`,
          },
        );
        if (error) throw error;
        setSubmitted(true);
        toast.success("Check your email for a reset link.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && (mode === "signup" || mode === "reset")) {
    return (
      <div className="text-center space-y-4">
        <h2
          className="font-serif text-2xl font-semibold"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          Check your email
        </h2>
        <p className="font-body text-sm text-muted-foreground">
          {mode === "signup"
            ? "We've sent a confirmation link. Click it to finish signing up."
            : "We've sent a reset link. Click it to choose a new password."}
        </p>
        <Button variant="outline" asChild>
          <Link to={ROUTES.APOTHECARY_SIGNIN}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const title =
    mode === "signup"
      ? "Create your Apothecary account"
      : mode === "signin"
        ? "Sign in to Apothecary"
        : "Reset your password";

  const submitLabel =
    mode === "signup"
      ? "Create account"
      : mode === "signin"
        ? "Sign in"
        : "Send reset link";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="text-center">
        <h1
          className="font-serif text-3xl font-bold"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {title}
        </h1>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      {mode !== "reset" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
      )}
      <Button
        type="submit"
        variant="eden"
        size="lg"
        className="w-full"
        disabled={submitting}
      >
        {submitting ? "Please wait…" : submitLabel}
      </Button>
      <div className="text-center text-sm font-body text-muted-foreground space-y-1">
        {mode === "signin" && (
          <>
            <p>
              <Link
                to={ROUTES.APOTHECARY_RESET}
                className="underline hover:opacity-70"
              >
                Forgot your password?
              </Link>
            </p>
            <p>
              Don't have an account?{" "}
              <Link
                to={ROUTES.APOTHECARY_SIGNUP}
                className="underline hover:opacity-70"
              >
                Create one
              </Link>
            </p>
          </>
        )}
        {mode === "signup" && (
          <p>
            Already have an account?{" "}
            <Link
              to={ROUTES.APOTHECARY_SIGNIN}
              className="underline hover:opacity-70"
            >
              Sign in
            </Link>
          </p>
        )}
        {mode === "reset" && (
          <p>
            Back to{" "}
            <Link
              to={ROUTES.APOTHECARY_SIGNIN}
              className="underline hover:opacity-70"
            >
              sign in
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
