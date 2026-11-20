"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, ArrowLeftRight, History } from "lucide-react";
import { useStore } from "@/lib/store";
import type { MovementType } from "@/lib/types";
import { Card, Empty, PageGuide, PageHeader, ProductCell, SearchInput, Stat, TableWrap, Button } from "@/components/ui";
import { MovementBadge, movementLabel } from "@/components/badges";
import { timeAgo } from "@/lib/humanize";
import { daysAgo, downloadCSV, fmtDateTime, fmtNum } from "@/lib/utils";

const TYPES: MovementType[] = ["Purchase In", "Sale Out", "Customer Return", "Return to Supplier", "Adjustment", "Damaged", "Opening Stock"];

export default function MovementsPage() {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [days, setDays] = useState("30");
  const [limit, setLimit] = useState(100);
  const pmap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const rows = useMemo(
    () =>
      data.movements
        .filter((m) => days === "all" || daysAgo(m.date) < +days)
        .filter((m) => !type || m.type === type)
        .filter((m) => {
          if (!q) return true;
          const p = pmap.get(m.productId);
          return `${p?.name} ${p?.styleCode} ${m.reference} ${m.note}`.toLowerCase().includes(q.toLowerCase());
        }),
    [data.movements, days, type, q, pmap],
  );

  const inQty = rows.filter((m) => m.qty > 0).reduce((t, m) => t + m.qty, 0);
  const outQty = rows.filter((m) => m.qty < 0).reduce((t, m) => t - m.qty, 0);

  return (
    <>
      <PageHeader
        title="Stock history"
        icon={ArrowLeftRight}
        subtitle="Every piece that came in or went out, and why. Handy when a count doesn't add up."
        actions={<Button onClick={() => downloadCSV("stock-ledger.csv", rows.map((m) => ({ Date: fmtDateTime(m.date), Type: movementLabel(m.type), Product: pmap.get(m.productId)?.name ?? "", SKU: `${pmap.get(m.productId)?.styleCode}-${m.size}`, Size: m.size, Qty: m.qty, Reference: m.reference, Note: m.note })))}><Download size={16} /> Export</Button>}
      />
      <PageGuide
        id="movements"
        steps={[
          <>This is a diary of your stock. Every sale, delivery, return and correction is written here automatically.</>,
          <><b className="text-ok">+ green</b> means pieces came in, <b className="text-bad">− red</b> means they went out.</>,
          <>If a count looks wrong, search for the product here to see exactly what happened to it.</>,
        ]}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Came in" value={`+${fmtNum(inQty)}`} tone="ok" hint="pieces" />
        <Stat label="Went out" value={`−${fmtNum(outQty)}`} tone="bad" hint="pieces" />
        <Stat label="Overall change" value={`${inQty - outQty >= 0 ? "+" : ""}${fmtNum(inQty - outQty)}`} hint="pieces" />
      </div>
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Product, PO, invoice…" />
          <select className="inp min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="What happened" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Everything</option>
            {TYPES.map((t) => <option key={t} value={t}>{movementLabel(t)}</option>)}
          </select>
          <select className="inp min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="Date range" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty title="Nothing happened in this period" icon={History}>Try a longer date range.</Empty>
        ) : (
          <>
          <ul className="mlist sm:grid-cols-2 xl:hidden" aria-label="Stock changes">
            {rows.slice(0, limit).map((m) => {
              const p = pmap.get(m.productId);
              return (
                <li key={m.id} className="mcard">
                  <div className="flex items-start justify-between gap-3">
                    {p ? <ProductCell p={p} href={`/inventory/${p.id}`} sub={`${p.color} · size ${m.size}`} /> : <span>—</span>}
                    <span className={`shrink-0 text-lg font-bold tabular-nums ${m.qty > 0 ? "text-ok" : "text-bad"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <MovementBadge type={m.type} />
                    <span>{timeAgo(m.date)}</span>
                    {m.reference && m.reference !== "ADJ" && m.reference !== "OPENING" && <span>· {m.reference}</span>}
                    {m.note && <span>· {m.note}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden xl:block">
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>When</th><th>What happened</th><th>Product</th><th>Size</th><th className="num">Pieces</th><th>Bill / order</th><th>Note</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((m) => {
                  const p = pmap.get(m.productId);
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-muted" title={fmtDateTime(m.date)}>{timeAgo(m.date)}</td>
                      <td><MovementBadge type={m.type} /></td>
                      <td className="min-w-52">{p ? <ProductCell p={p} href={`/inventory/${p.id}`} sub={p.color} /> : "—"}</td>
                      <td>{m.size}</td>
                      <td className={`num font-medium ${m.qty > 0 ? "text-ok" : "text-bad"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                      <td className="whitespace-nowrap text-xs">{m.reference}</td>
                      <td className="text-xs text-muted">{m.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          </div>
          </>
        )}
        {rows.length > limit && (
          <div className="border-t border-line p-3 text-center">
            <Button size="sm" onClick={() => setLimit((l) => l + 100)}>Show more ({rows.length - limit} more)</Button>
          </div>
        )}
      </Card>
    </>
  );
}
