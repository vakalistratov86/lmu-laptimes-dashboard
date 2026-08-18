import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Link, useLocation } from "wouter";
import { LogIn } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useAuth, getAuthErrorMessage } from "@/lib/auth";
import { LoginSchema } from "@shared/validators";

type LoginFormValues = z.infer<typeof LoginSchema>;

export default function Login() {
  const { t } = useLanguage();
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await login(values);
      toast({ title: t("auth.toastLoginSuccessTitle"), description: t("auth.toastLoginSuccessDesc") });
      navigate("/");
    } catch (e: unknown) {
      const msg = getAuthErrorMessage(e, t("auth.toastErrorTitle"));
      form.setError("password", { message: msg });
      toast({ title: t("auth.toastErrorTitle"), description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center py-10">
      <Card className="w-full max-w-sm" data-testid="card-login">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LogIn size={18} />
          </div>
          <CardTitle className="font-display text-xl">{t("auth.loginTitle")}</CardTitle>
          <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.emailLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("auth.emailPlaceholder")}
                        autoComplete="email"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.passwordLabel")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" data-testid="input-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-submit-login">
                {isLoggingIn ? t("auth.loggingIn") : t("auth.loginCta")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.noAccountYet")}{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
              data-testid="link-go-to-register"
            >
              {t("auth.goToRegister")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
