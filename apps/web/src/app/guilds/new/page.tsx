"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, CardBody, FieldError, FieldGroup, Input, Label, Textarea, useToast } from "@railcards/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { guildsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

function NewGuildForm() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");

  const nameValid = name.trim().length >= 3 && name.trim().length <= 30;
  const tagValid = /^[A-Za-z0-9]{2,5}$/.test(tag.trim());

  const createMutation = useMutation({
    mutationFn: () => guildsApi.create({ name: name.trim(), tag: tag.trim(), description: description.trim() || undefined }),
    onSuccess: (guild) => {
      toast.show({ tone: "success", title: "Guilde fondée" });
      router.push(`/guilds/${guild.id}`);
    },
    onError: (err) => toast.show({ tone: "error", title: "Création impossible", description: getErrorMessage(err) }),
  });

  return (
    <Card className="mx-auto max-w-lg">
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nameValid && tagValid) createMutation.mutate();
          }}
          noValidate
        >
          <FieldGroup>
            <Label htmlFor="name">Nom de la guilde</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} invalid={name.length > 0 && !nameValid} />
            {name.length > 0 && !nameValid && <FieldError>Entre 3 et 30 caractères.</FieldError>}
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="tag">Tag (2 à 5 caractères)</Label>
            <Input
              id="tag"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              maxLength={5}
              invalid={tag.length > 0 && !tagValid}
            />
            {tag.length > 0 && !tagValid && <FieldError>2 à 5 lettres ou chiffres, sans espace.</FieldError>}
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="description">Description (optionnelle)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Qui êtes-vous, que recherchez-vous chez vos membres…"
            />
          </FieldGroup>
          <Button type="submit" fullWidth loading={createMutation.isPending} disabled={!nameValid || !tagValid}>
            Fonder la guilde
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function NewGuildPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader title="Fonder une guilde" description="Vous en deviendrez automatiquement le chef." />
        <NewGuildForm />
      </AppShell>
    </RequireAuth>
  );
}
