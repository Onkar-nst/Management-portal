"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Receipt } from "lucide-react";
import { useStore } from "@/lib/store";
import { CHANNELS, PAYMENT_METHODS } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, PageGuide, PageHeader, SearchInput, Stat, TableWrap } from "@/components/ui";
import { timeAgo } from "@/lib/humanize";
import { daysAgo, downloadCSV, fmtDateTime, fmtNum, money, saleProfit, saleSubtotal, saleTax, saleTotal, saleUnits } from "@/lib/utils";

const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;

export default function SalesPage() {
  const { data } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [range, setRange] = useState<keyof typeof RANGES>("30");
  const [channel, setChannel] = useState("");
  const [payment, setPayment] = useState("");
  const [limit, setLimit] = useState(60);

  const rows = useMemo(
    () =>
      data.sales
        .filter((s) => range === "all" || daysAgo(s.date) < +range)
        .filter((s) => !channel || s.channel === channel)
        .filter((s) => !payment || s.paymentMethod === payment)
        .filter((s) => !q || `${s.invoiceNumber} ${s.customerName} ${s.customerPhone}`.toLowerCase().includes(q.toLowerCase())),
    [data.sales, range, channel, payment, q],
  );

  const revenue = rows.reduce((t, s) => t + saleSubtotal(s), 0);
  const profit = rows.reduce((t, s) => t + saleProfit(s), 0);
  const units = rows.reduce((t, s) => t + saleUnits(s), 0);
  const gst = rows.reduce((t, s) => t + saleTax(s), 0);

  const exportCSV = () =>
    downloadCSV(
      "sales.csv",
      rows.map((s) => ({
        Invoice: s.invoiceNumber,
        Date: fmtDateTime(s.date),
        Customer: s.customerName,
        Phone: s.customerPhone,
        Channel: s.channel,
        Payment: s.paymentMethod,
        Units: saleUnits(s),
        "Taxable value": Math.round(saleSubtotal(s)),
        GST: Math.round(saleTax(s)),
        Total: Math.round(saleTotal(s)),
        Profit: Math.round(saleProfit(s)),
      })),
    );

  return (
    <>
      <PageHeader
        title="Past sales"
        icon={Receipt}
        subtitle="Every bill: what sold, for how much, and what you made on it"
        actions={
          <>
            <Button onClick={exportCSV}><Download size={16} /> Export CSV</Button>
            <Link href="/pos"><Button variant="primary"><Plus size={16} /> Make a sale</Button></Link>
          </>
        }
      />
      <PageGuide
        id="sales"
        steps={[
          <>Every bill you&apos;ve made is listed here, newest first.</>,
          <>Search by bill number, customer name or phone. Click a bill to see it, print it, or take back a return.</>,
          <>The boxes at the top add up the bills you&apos;re looking at. Change the dates to see other periods.</>,
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={money(revenue)} hint={`${rows.length} bills · before GST`} />
        <Stat label="Your profit" value={money(profit)} tone="ok" hint={revenue ? `${Math.round((profit / revenue) * 100)}% margin` : undefined} />
        <Stat label="Pieces sold" value={fmtNum(units)} hint={rows.length ? `about ${(units / rows.length).toFixed(1)} per bill` : undefined} />
        <Stat label="GST collected" help="Tax you collected from customers. You pay this to the government." value={money(gst)} hint={rows.length ? `Avg bill ${money((revenue + gst) / rows.length)}` : undefined} />
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Invoice, customer, phone…" />
          <select className="inp w-full sm:w-auto" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value as keyof typeof RANGES)}>
            {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="inp min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="Sold through" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">All channels</option>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="inp min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="Paid by" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All payments</option>
            {PAYMENT_METHODS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty title="No sales match" icon={Receipt}>Try a longer date range or clear the filters.</Empty>
        ) : (
          <>
          <ul className="mlist sm:grid-cols-2 xl:hidden" aria-label="Bills">
            {rows.slice(0, limit).map((s) => {
              const returned = s.items.some((i) => i.returnedQty > 0);
              return (
                <li key={s.id}>
                  <Link href={`/sales/${s.id}`} className="mcard">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.customerName} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{s.customerName}</div>
                        <div className="truncate text-xs text-muted">{timeAgo(s.date)} · {saleUnits(s)} {saleUnits(s) === 1 ? "piece" : "pieces"} · {s.paymentMethod === "Credit" ? "Pay later" : s.paymentMethod}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold tabular-nums">{money(saleTotal(s))}</div>
                        <div className="text-xs text-ok">+{money(saleProfit(s))}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{s.invoiceNumber}</span>
                      {s.channel !== "Store" && <Badge tone={s.channel === "Wholesale" ? "info" : "brand"}>{s.channel}</Badge>}
                      {s.paymentMethod === "Credit" && <Badge tone="warn">On credit</Badge>}
                      {returned && <Badge tone="info">Return</Badge>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden xl:block">
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr><th>Customer</th><th>When</th><th>Bill no.</th><th>Sold via</th><th>Paid by</th><th className="num">Pieces</th><th className="num">Total</th><th className="num">Profit</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((s) => {
                  const returned = s.items.some((i) => i.returnedQty > 0);
                  return (
                    <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/sales/${s.id}`)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={s.customerName} size={32} />
                          <div><div className="font-semibold">{s.customerName}</div>{s.customerPhone && <div className="text-xs text-muted">{s.customerPhone}</div>}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-muted" title={fmtDateTime(s.date)}>{timeAgo(s.date)}</td>
                      <td className="whitespace-nowrap"><Link href={`/sales/${s.id}`} className="text-xs font-medium hover:text-brand">{s.invoiceNumber}</Link>{returned && <span className="ml-1.5"><Badge tone="info">Return</Badge></span>}</td>
                      <td><Badge tone={s.channel === "Wholesale" ? "info" : s.channel === "Online" ? "brand" : "neutral"}>{s.channel}</Badge></td>
                      <td>{s.paymentMethod === "Credit" ? <Badge tone="warn">On credit</Badge> : s.paymentMethod}</td>
                      <td className="num">{saleUnits(s)}</td>
                      <td className="num font-medium">{money(saleTotal(s))}</td>
                      <td className="num text-ok">{money(saleProfit(s))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          </div>
          {rows.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <Button size="sm" onClick={() => setLimit((l) => l + 60)}>Show more ({rows.length - limit} more bills)</Button>
            </div>
          )}
          </>
        )}
      </Card>
    </>
  );
}
