"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "railcards.reduceMotion";

/**
 * Global "skip/reduce animations" preference: seeded from
 * `prefers-reduced-motion` and overridable per-viewer via the booster-reveal
 * skip toggle (persisted only as a local convenience, never as game state).
 */
export function usePrefersReducedMotion(): [boolean, (v: boolean) => void] {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore (private mode / blocked storage)
    }
    if (stored !== null) {
      setReduced(stored === "1");
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const set = (v: boolean) => {
    setReduced(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
  };

  return [reduced, set];
}
