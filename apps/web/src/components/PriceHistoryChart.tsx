"use client";

import { useId, useMemo } from "react";
import type { PriceHistoryPoint } from "@/lib/types";
import { formatDate } from "@/lib/format";

const WIDTH = 480;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_Y = 16;

/**
 * A single-series line-with-range chart (daily average price, min/max band
 * behind it) for a card's recent market sales. No legend — one series, the
 * card's name is already the page's own heading. Native <title> elements on
 * each point give an accessible hover tooltip without pulling in a charting
 * library for what's a handful of daily points.
 */
export function PriceHistoryChart({ points }: { points: PriceHistoryPoint[] }) {
  const gradientId = useId();

  const { linePath, bandPath, dots, minVal, maxVal } = useMemo(() => {
    const values = points.flatMap((p) => [p.minPriceCr, p.maxPriceCr]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = Math.max(1, maxVal - minVal);

    const xFor = (i: number) => (points.length <= 1 ? WIDTH / 2 : PAD_X + (i / (points.length - 1)) * (WIDTH - PAD_X * 2));
    const yFor = (v: number) => HEIGHT - PAD_Y - ((v - minVal) / range) * (HEIGHT - PAD_Y * 2);

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.avgPriceCr)}`).join(" ");
    const topPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.maxPriceCr)}`).join(" ");
    const bottomPath = [...points]
      .reverse()
      .map((p, i) => `L${xFor(points.length - 1 - i)},${yFor(p.minPriceCr)}`)
      .join(" ");
    const bandPath = `${topPath} ${bottomPath} Z`;

    const dots = points.map((p, i) => ({ x: xFor(i), y: yFor(p.avgPriceCr), point: p }));

    return { linePath, bandPath, dots, minVal, maxVal };
  }, [points]);

  if (points.length === 0) {
    return <p className="text-sm text-white/50">Aucune vente enregistrée récemment.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Historique des prix de vente">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-rc-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-rc-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={bandPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--color-rc-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {dots.map(({ x, y, point }) => (
          <circle key={point.day} cx={x} cy={y} r={3} fill="var(--color-rc-accent)">
            <title>
              {formatDate(point.day)} — {point.avgPriceCr} CR en moyenne ({point.salesCount} vente{point.salesCount > 1 ? "s" : ""})
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-white/40">
        <span>{formatDate(points[0]!.day)}</span>
        <span className="text-white/60">
          {minVal}–{maxVal} CR
        </span>
        <span>{formatDate(points[points.length - 1]!.day)}</span>
      </div>
    </div>
  );
}
