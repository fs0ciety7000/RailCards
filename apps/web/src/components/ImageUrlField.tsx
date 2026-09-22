"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus } from "lucide-react";
import { Button, FieldError, FieldGroup, Input, Label } from "@railcards/ui";
import { adminApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";

/** URL text field with an "upload" shortcut that fills it in automatically. */
export function ImageUrlField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be re-selected later
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await adminApi.uploadImage(file);
      onChange(result.url);
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <FieldGroup>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!error}
          placeholder="https:// ou /card-placeholders/…"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          loading={uploading}
          icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
        >
          Uploader
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFile} />
      {value && (
        // Arbitrary admin-supplied URLs (any external host) can't go through
        // next/image's remotePatterns allowlist, so a plain <img> preview it is.
        <img
          src={value}
          alt=""
          className="mt-2 h-20 w-20 rounded-lg border border-rc-border object-cover"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
          onLoad={(e) => {
            e.currentTarget.style.visibility = "visible";
          }}
        />
      )}
      <FieldError>{error ?? uploadError ?? undefined}</FieldError>
    </FieldGroup>
  );
}
