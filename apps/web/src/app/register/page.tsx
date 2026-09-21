"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@railcards/contracts";
import { Button, Card, CardBody, FieldError, FieldGroup, Input, Label, useToast } from "@railcards/ui";
import { authApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { useAuthStore } from "@/lib/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const justSubmitted = useRef(false);
  useEffect(() => {
    if (!justSubmitted.current && hydrated && accessToken) router.replace("/home");
  }, [hydrated, accessToken, router]);

  async function onSubmit(values: RegisterInput) {
    try {
      const res = await authApi.register({
        ...values,
        invitationCode: values.invitationCode?.trim() || undefined,
      });
      justSubmitted.current = true;
      setSession(res.accessToken, res.user);
      try {
        localStorage.setItem("railcards.needsOnboarding", "1");
      } catch {
        // ignore: onboarding is a convenience, not required game state
      }
      router.replace("/onboarding");
    } catch (err) {
      toast.show({ tone: "error", title: "Inscription impossible", description: getErrorMessage(err) });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-rc-night bg-rail-lines px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-display text-3xl font-bold text-rc-accent">🚆 RailCards</p>
          <p className="mt-1 text-sm text-white/60">Rejoignez le réseau, une carte à la fois</p>
        </div>
        <Card>
          <CardBody>
            <h1 className="mb-4 text-lg font-bold text-white">Créer un compte</h1>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
                <FieldError>{errors.email?.message}</FieldError>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="username">Nom d&apos;utilisateur</Label>
                <Input id="username" autoComplete="username" invalid={!!errors.username} {...register("username")} />
                <FieldError>{errors.username?.message}</FieldError>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="displayName">Nom affiché</Label>
                <Input id="displayName" invalid={!!errors.displayName} {...register("displayName")} />
                <FieldError>{errors.displayName?.message}</FieldError>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  invalid={!!errors.password}
                  {...register("password")}
                />
                <FieldError>{errors.password?.message}</FieldError>
                <p className="mt-1 text-xs text-white/40">
                  10 caractères min., avec majuscule, minuscule et chiffre.
                </p>
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="invitationCode">Code d&apos;invitation</Label>
                <Input id="invitationCode" invalid={!!errors.invitationCode} {...register("invitationCode")} />
                <FieldError>{errors.invitationCode?.message}</FieldError>
                <p className="mt-1 text-xs text-white/40">RailCards est actuellement sur invitation uniquement.</p>
              </FieldGroup>
              <Button type="submit" fullWidth loading={isSubmitting}>
                Créer mon compte
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-4 text-center text-sm text-white/60">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-semibold text-rc-accent hover:underline">
            Connectez-vous
          </Link>
        </p>
      </div>
    </div>
  );
}
