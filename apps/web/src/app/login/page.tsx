"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { TrainFront } from "lucide-react";
import { loginSchema, type LoginInput } from "@railcards/contracts";
import { Button, Card, CardBody, FieldError, FieldGroup, Input, Label, useToast } from "@railcards/ui";
import { authApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Only auto-redirect for a session restored before this page mounted
  // (e.g. an already-logged-in visitor landing on /login); the submit
  // handler below owns navigation for a session created by this form, so it
  // marks `justSubmitted` to avoid a race between the two redirects.
  const justSubmitted = useRef(false);
  useEffect(() => {
    if (!justSubmitted.current && hydrated && accessToken) router.replace("/home");
  }, [hydrated, accessToken, router]);

  async function onSubmit(values: LoginInput) {
    try {
      const res = await authApi.login(values);
      justSubmitted.current = true;
      setSession(res.accessToken, res.user);
      router.replace("/home");
    } catch (err) {
      toast.show({ tone: "error", title: "Connexion impossible", description: getErrorMessage(err) });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-rc-night bg-rail-lines px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rc-accent text-rc-night shadow-rc-glow"
          >
            <TrainFront className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <p className="font-display text-2xl font-bold tracking-tight text-white">RailCards</p>
          <p className="mt-1 text-sm text-white/55">L&apos;univers ferroviaire belge à collectionner</p>
        </div>
        <Card>
          <CardBody>
            <h1 className="mb-4 text-lg font-bold tracking-tight text-white">Connexion</h1>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError>{errors.email?.message}</FieldError>
              </FieldGroup>
              <FieldGroup>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-rc-accent hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  invalid={!!errors.password}
                  {...register("password")}
                />
                <FieldError>{errors.password?.message}</FieldError>
              </FieldGroup>
              <Button type="submit" fullWidth loading={isSubmitting}>
                Se connecter
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-4 text-center text-sm text-white/60">
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-semibold text-rc-accent hover:underline">
            Inscrivez-vous
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
