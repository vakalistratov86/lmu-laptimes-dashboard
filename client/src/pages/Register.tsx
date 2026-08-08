import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useAuth, getAuthErrorMessage } from "@/lib/auth";
import { RegisterSchema } from "@shared/validators";

type RegisterFormValues = z.infer<typeof RegisterSchema> & { confirmPassword: string };

export default function Register() {
  const { t } = useLanguage();
  const { register, isRegistering } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const formSchema = useMemo(
    () =>
      RegisterSchema.extend({ confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, {
        message: t("auth.passwordMismatch"),
        path: ["confirmPassword"],
      }),
    [t],
  );

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", displayName: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      await register(values);
      toast({ title: t("auth.toastRegisterSuccessTitle"), description: t("auth.toastRegisterSuccessDesc") });
      navigate("/");
    } catch (e: unknown) {
      const msg = getAuthErrorMessage(e, t("auth.toastErrorTitle"));
      form.setError("email", { message: msg });
      toast({ title: t("auth.toastErrorTitle"), description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center py-10">
      <Card className="w-full max-w-sm" data-testid="card-register">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserPlus size={18} />
          </div>
          <CardTitle className="font-display text-xl">{t("auth.registerTitle")}</CardTitle>
          <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.displayNameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.displayNamePlaceholder")}
                        autoComplete="name"
                        data-testid="input-display-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <Input
                        type="password"
                        placeholder={t("auth.passwordPlaceholder")}
                        autoComplete="new-password"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.confirmPasswordLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isRegistering} data-testid="button-submit-register">
                {isRegistering ? t("auth.registering") : t("auth.registerCta")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.haveAccountAlready")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline" data-testid="link-go-to-login">
              {t("auth.goToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
