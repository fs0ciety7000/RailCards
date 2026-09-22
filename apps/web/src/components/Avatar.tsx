"use client";

import Image from "next/image";
import { Crown } from "lucide-react";

/** Player avatar: falls back to a letter, and rings/badges admins in gold. */
export function Avatar({
  avatarUrl,
  displayName,
  isAdmin,
  size = 80,
}: {
  avatarUrl: string | null;
  displayName: string;
  isAdmin: boolean;
  size?: number;
}) {
  return (
    <span
      className={
        "relative flex items-center justify-center overflow-hidden rounded-full " +
        (isAdmin
          ? "bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 p-[3px] shadow-[0_0_20px_rgba(245,197,66,0.55)]"
          : "")
      }
      style={{ width: size, height: size }}
    >
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-rc-accent font-bold text-rc-night"
        style={{ fontSize: size * 0.4 }}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
        ) : (
          displayName.slice(0, 1).toUpperCase()
        )}
      </span>
      {isAdmin && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-rc-night shadow ring-2 ring-rc-night"
          style={{ width: Math.max(16, size * 0.3), height: Math.max(16, size * 0.3) }}
          title="Administrateur"
        >
          <Crown className="h-[55%] w-[55%]" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
