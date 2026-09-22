"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { ArrowLeft, MailCheck, TrainFront } from "lucide-react";
import { requestPasswordResetSchema, type RequestPasswordResetInput } from "@railcards/contracts";
import { Button, Card, CardBody, FieldError, FieldGroup, Input, Label, useToast } from "@railcards/ui";
import { authApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetInput>({ resolver: zodResolver(requestPasswordResetSchema) });

  async function onSubmit(values: RequestPasswordResetInput) {
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (err) {
      toast.show({ tone: "error", title: "Échec de la demande", description: getErrorMessage(err) });
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
        </div>
        <Card>
          <CardBody>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rc-accent/15 text-rc-accent">
                  <MailCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <h1 className="text-lg font-bold tracking-tight text-white">Email envoyé</h1>
                <p className="text-sm text-white/60">
                  Si cette adresse est enregistrée, un lien de réinitialisation vient d&apos;être envoyé.
                </p>
              </div>
            ) : (
              <>
                <h1 className="mb-1 text-lg font-bold tracking-tight text-white">Mot de passe oublié</h1>
                <p className="mb-4 text-sm text-white/55">
                  Indiquez votre email et nous vous enverrons un lien de réinitialisation.
                </p>
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <FieldGroup>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
                    <FieldError>{errors.email?.message}</FieldError>
                  </FieldGroup>
                  <Button type="submit" fullWidth loading={isSubmitting}>
                    Envoyer le lien
                  </Button>
                </form>
              </>
            )}
          </CardBody>
        </Card>
        <Link href="/login" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-white/60 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Retour à la connexion
        </Link>
      </motion.div>
    </div>
  );
}
