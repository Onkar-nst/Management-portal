"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Download, PackageCheck, Truck, PackageOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import type { POStatus } from "@/lib/types";
import { Avatar, Button, Card, Empty, PageGuide, PageHeader, SearchInput, Stat, TableWrap } from "@/components/ui";
import { dueIn } from "@/lib/humanize";
import { POStatusBadge } from "@/components/badges";
import { POForm, type POMode } from "@/components/POForm";
import { cn, downloadCSV, fmtDate, fmtNum, money, poPending, poUnits, poValue } from "@/lib/utils";

const TABS: ("Open" | POStatus | "All")[] = ["Open", "Ordered", "In Transit", "Partially Received", "Received", "Cancelled", "All"];
const TAB_LABEL: Record<string, string> = { Open: "Not arrived yet", Ordered: "Ordered", "In Transit": "On the way", "Partially Received": "Partly arrived", Received: "Received", Cancelled: "Cancelled", All: "All" };
const OPEN: POStatus[] = ["Ordered", "In Transit", "Partially Received"];

function PurchasesInner() {
  const { data } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Open");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<POMode | null>(null);

  useEffect(() => {
    const n = params.get("new");
    if (n) {
      setCreating(n === "arrived" ? "arrived" : "ordered");
      router.replace("/purchases");
    }
  }, [params, router]);

  const supplierName = (id: string) => data.suppliers.find((s) => s.id === id)?.name ?? "—";

  const rows = useMemo(
    () =>
      data.purchaseOrders
        .filter((po) => (tab === "All" ? true : tab === "Open" ? OPEN.includes(po.status) : po.status === tab))
        .filter((po) => !q || `${po.poNumber} ${supplierName(po.supplierId)} ${po.invoiceNumber}`.toLowerCase().includes(q.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.purchaseOrders, data.suppliers, tab, q],
  );

  const open = data.purchaseOrders.filter((p) => OPEN.includes(p.status));
  const overdue = open.filter((p) => dueIn(p.expectedDate).late);
  const last90 = data.purchaseOrders.filter((p) => p.status !== "Cancelled" && Date.now() - new Date(p.orderDate).getTime() < 90 * 86_400_000);

  return (
    <>
      <PageHeader
        title="Deliveries"
        icon={Truck}
        subtitle="Stock coming in from your suppliers: what's ordered, what's on the way, and what has arrived"
        actions={
          <>
            <Button className="max-sm:!hidden" onClick={() => downloadCSV("purchase-orders.csv", rows.map((po) => ({ PO: po.poNumber, Supplier: supplierName(po.supplierId), Status: po.status, "Order date": fmtDate(po.orderDate), Expected: fmtDate(po.expectedDate), Received: fmtDate(po.receivedDate), Units: poUnits(po), Pending: poPending(po), Value: poValue(po), "Supplier invoice": po.invoiceNumber ?? "" })))}>
              <Download size={16} /> Export
            </Button>
            <Button onClick={() => setCreating("ordered")}><CalendarClock size={16} /> Order stock</Button>
            <Button variant="primary" onClick={() => setCreating("arrived")}><PackageCheck size={16} /> Stock arrived</Button>
          </>
        }
      />

      <PageGuide
        id="deliveries"
        steps={[
          <>Goods just came in? Press <b>Stock arrived</b>, pick the products and type how many of each size. They&apos;re added to stock right away.</>,
          <>Ordered something that hasn&apos;t come yet? Press <b>Order stock</b> to keep track of it.</>,
          <>When an order arrives, open it and press <b>Goods arrived</b>. Late orders are marked in red.</>,
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders not yet arrived" value={open.length} tone="info" />
        <Stat label="Pieces on the way" value={fmtNum(open.reduce((t, p) => t + poPending(p), 0))} />
        <Stat label="Running late" value={overdue.length} tone={overdue.length ? "bad" : "ok"} hint={overdue.length ? "Past the expected date. Maybe give them a call" : "Everything is on schedule"} />
        <Stat label="Bought in the last 90 days" value={money(last90.reduce((t, p) => t + poValue(p), 0))} hint={`${last90.length} orders`} />
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="scroll-x flex w-full gap-1.5 sm:w-auto sm:flex-wrap sm:gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={cn("shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium sm:rounded-lg sm:border-0 sm:px-3 sm:py-1.5", tab === t ? "border-ink bg-ink text-white" : "border-line hover:bg-canvas")}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="w-full sm:ml-auto sm:w-auto"><SearchInput value={q} onChange={setQ} placeholder="PO, supplier, invoice…" /></div>
        </div>
        {rows.length === 0 ? (
          <Empty title="No orders here" icon={PackageOpen} action={<Button variant="primary" onClick={() => setCreating("arrived")}><PackageCheck size={15} /> Stock arrived</Button>}>When you order from a supplier, it shows up here until it arrives.</Empty>
        ) : (
          <>
          <ul className="mlist sm:grid-cols-2 xl:hidden" aria-label="Deliveries">
            {rows.map((po) => {
              const open = OPEN.includes(po.status);
              const due = dueIn(po.expectedDate);
              return (
                <li key={po.id}>
                  <Link href={`/purchases/${po.id}`} className="mcard">
                    <div className="flex items-center gap-3">
                      <Avatar name={supplierName(po.supplierId)} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{supplierName(po.supplierId)}</div>
                        <div className="text-xs text-muted">{po.poNumber} · {poUnits(po)} pieces · {money(poValue(po))}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <POStatusBadge status={po.status} />
                      <span className={cn("text-xs", open && due.late ? "font-semibold text-bad" : "text-muted")}>
                        {open ? `${poPending(po)} still to come · ${due.text}` : po.status === "Received" ? `Arrived ${fmtDate(po.receivedDate)}` : `Ordered ${fmtDate(po.orderDate)}`}
                      </span>
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
                <tr><th>Supplier</th><th>Ordered</th><th>Expected</th><th>Arrived</th><th className="num">Pieces</th><th className="num">Still to come</th><th className="num">Value</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((po) => {
                  const late = OPEN.includes(po.status) && dueIn(po.expectedDate).late;
                  return (
                    <tr key={po.id} className="cursor-pointer" onClick={() => router.push(`/purchases/${po.id}`)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={supplierName(po.supplierId)} size={34} />
                          <div><div className="font-semibold">{supplierName(po.supplierId)}</div><Link href={`/purchases/${po.id}`} className="text-xs text-muted hover:text-brand">{po.poNumber}</Link></div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{fmtDate(po.orderDate)}</td>
                      <td className="whitespace-nowrap">{fmtDate(po.expectedDate)}{OPEN.includes(po.status) && <div className={cn("text-xs", late ? "font-semibold text-bad" : "text-muted")}>{dueIn(po.expectedDate).text}</div>}</td>
                      <td className="whitespace-nowrap text-muted">{fmtDate(po.receivedDate)}</td>
                      <td className="num">{poUnits(po)}</td>
                      <td className="num">{poPending(po) || "—"}</td>
                      <td className="num">{money(poValue(po))}</td>
                      <td><POStatusBadge status={po.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          </div>
          </>
        )}
      </Card>

      <POForm
        open={!!creating}
        initialMode={creating ?? "ordered"}
        onClose={() => setCreating(null)}
        onCreated={(id) => router.push(`/purchases/${id}`)}
      />
    </>
  );
}

export default function PurchasesPage() {
  return <Suspense><PurchasesInner /></Suspense>;
}
