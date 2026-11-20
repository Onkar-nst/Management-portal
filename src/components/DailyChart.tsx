"use client";
import { useState } from "react";
import { money } from "@/lib/utils";

/** Daily revenue columns with hover readout. */
export function DailyChart({ points }: { points: { date: string; revenue: number; units: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const shown = hover ?? points.length - 1;
  const cur = points[shown];
  const label = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3 text-sm">
        <span className="font-semibold tabular-nums">{money(cur?.revenue ?? 0)}</span>
        <span className="text-muted">
          {cur ? `${label(cur.date)} · ${cur.units} units` : ""}
        </span>
      </div>
      <div className="flex h-40 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => (
          <div
            key={p.date}
            className="group flex h-full flex-1 cursor-default items-end"
            onMouseEnter={() => setHover(i)}
          >
            <div
              className={`w-full rounded-t-[3px] transition-colors ${i === shown ? "bg-brand" : "bg-brand/35 group-hover:bg-brand/60"}`}
              style={{ height: `${Math.max(2, (p.revenue / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{points[0] && label(points[0].date)}</span>
        <span>{points.at(-1) && label(points.at(-1)!.date)}</span>
      </div>
    </div>
  );
}
