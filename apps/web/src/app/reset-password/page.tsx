"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { CheckCircle2, TrainFront } from "lucide-react";
import { z } from "zod";
import { passwordSchema } from "@railcards/contracts";
import { Button, Card, CardBody, FieldError, FieldGroup, Input, Label, useToast } from "@railcards/ui";
import { authApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

const resetPasswordFormSchema = z.object({ password: passwordSchema });
type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({ resolver: zodResolver(resetPasswordFormSchema) });

  async function onSubmit(values: ResetPasswordFormInput) {
    try {
      await authApi.resetPassword({ token, password: values.password });
      setDone(true);
    } catch (err) {
      toast.show({ tone: "error", title: "Réinitialisation impossible", description: getErrorMessage(err) });
    }
  }

  if (!token) {
    return (
      <Card>
        <CardBody className="text-center text-sm text-white/60">
          <p>Ce lien de réinitialisation est invalide.</p>
          <Link href="/forgot-password" className="mt-3 inline-block font-semibold text-rc-accent hover:underline">
            Demander un nouveau lien
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rc-accent/15 text-rc-accent">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold tracking-tight text-white">Mot de passe réinitialisé</h1>
          <p className="text-sm text-white/60">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
          <Button onClick={() => router.replace("/login")} fullWidth>
            Se connecter
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h1 className="mb-1 text-lg font-bold tracking-tight text-white">Nouveau mot de passe</h1>
        <p className="mb-4 text-sm text-white/55">Choisissez un nouveau mot de passe pour votre compte.</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
            <FieldError>{errors.password?.message}</FieldError>
          </FieldGroup>
          <Button type="submit" fullWidth loading={isSubmitting}>
            Réinitialiser
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
