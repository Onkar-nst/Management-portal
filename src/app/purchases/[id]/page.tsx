"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, PackageCheck, Truck, XCircle, Printer, SearchX } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Card, Confirm, Empty, Field, Modal, ProductCell, Stat, TableWrap } from "@/components/ui";
import { dueIn, plural } from "@/lib/humanize";
import { POStatusBadge } from "@/components/badges";
import { fmtDate, money, poPending, poUnits, poValue } from "@/lib/utils";

export default function PODetail() {
  const { id } = useParams<{ id: string }>();
  const { data, setPOStatus, receivePurchaseOrder, toast } = useStore();
  const po = data.purchaseOrders.find((p) => p.id === id);
  const [receiving, setReceiving] = useState<number[] | null>(null);
  const [inv, setInv] = useState("");
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!po) return <Empty title="We couldn't find that order" icon={SearchX} action={<Link href="/purchases"><Button>Back to deliveries</Button></Link>} />;

  const supplier = data.suppliers.find((s) => s.id === po.supplierId);
  const pmap = new Map(data.products.map((p) => [p.id, p]));
  const open = ["Ordered", "In Transit", "Partially Received"].includes(po.status);
  const received = po.items.reduce((t, i) => t + i.qtyReceived, 0);

  const startReceive = () => {
    setInv(po.invoiceNumber ?? "");
    setNote("");
    setReceiving(po.items.map((i) => i.qtyOrdered - i.qtyReceived));
  };

  const submitReceive = () => {
    if (!receiving) return;
    const r = receivePurchaseOrder(po.id, receiving, inv, note);
    if (!r.ok) return toast(r.error, "error");
    toast(`${receiving.reduce((a, b) => a + b, 0)} pieces added to stock.`);
    setReceiving(null);
  };

  return (
    <>
      <Link href="/purchases" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink print:hidden"><ArrowLeft size={14} /> Deliveries</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={supplier?.name ?? "?"} size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{supplier?.name ?? "Unknown supplier"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono text-xs">{po.poNumber}</span> · ordered {fmtDate(po.orderDate)}
              {open && <span className={dueIn(po.expectedDate).late ? "font-semibold text-bad" : ""}>· {dueIn(po.expectedDate).text}</span>}
              <POStatusBadge status={po.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {po.status === "Ordered" && <Button onClick={() => { const r = setPOStatus(po.id, "In Transit"); toast(r.ok ? "Marked as on the way." : r.error, r.ok ? "success" : "error"); }}><Truck size={15} /> It&apos;s been dispatched</Button>}
          {open && <Button variant="primary" onClick={startReceive}><PackageCheck size={15} /> Goods arrived</Button>}
          {po.status === "Ordered" && <Button variant="danger" onClick={() => setConfirmCancel(true)}><XCircle size={15} /> Cancel order</Button>}
          <Button onClick={() => window.print()}><Printer size={15} /> Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pieces ordered" value={poUnits(po)} />
        <Stat label="Arrived so far" value={received} tone={received ? "ok" : undefined} />
        <Stat label="Still to come" value={poPending(po)} tone={poPending(po) && open ? "info" : undefined} />
        <Stat label="Order value" value={money(poValue(po))} hint={supplier ? `Pay within ${supplier.paymentTermsDays} days` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="What was ordered" className="xl:col-span-2" pad={false}>
          <ul className="divide-y divide-line md:hidden print:hidden" aria-label="Items on this order">
            {po.items.map((it, i) => {
              const p = pmap.get(it.productId);
              const done = it.qtyReceived >= it.qtyOrdered;
              return (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  {p ? <ProductCell p={p} href={`/inventory/${p.id}`} sub={`${p.color} · size ${it.size} · ${money(it.unitCost)} each`} /> : <span>Deleted product</span>}
                  <div className="shrink-0 text-right text-sm">
                    <div className={`font-bold tabular-nums ${done ? "text-ok" : it.qtyReceived ? "text-warn" : ""}`}>{it.qtyReceived}/{it.qtyOrdered}</div>
                    <div className="text-xs text-muted">arrived</div>
                  </div>
                </li>
              );
            })}
            <li className="flex justify-between px-4 py-3 font-semibold"><span>Total</span><span className="tabular-nums">{money(poValue(po))}</span></li>
          </ul>
          <div className="hidden md:block print:block">
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Product</th><th>Size</th><th className="num">Ordered</th><th className="num">Arrived</th><th className="num">Price each</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {po.items.map((it, i) => {
                  const p = pmap.get(it.productId);
                  return (
                    <tr key={i}>
                      <td>{p ? <ProductCell p={p} href={`/inventory/${p.id}`} /> : "Deleted product"}</td>
                      <td>{it.size}</td>
                      <td className="num">{it.qtyOrdered}</td>
                      <td className={`num ${it.qtyReceived >= it.qtyOrdered ? "text-ok" : it.qtyReceived ? "text-warn" : "text-muted"}`}>{it.qtyReceived}</td>
                      <td className="num">{money(it.unitCost)}</td>
                      <td className="num">{money(it.unitCost * it.qtyOrdered)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={5} className="num font-semibold">Total</td><td className="num font-semibold">{money(poValue(po))}</td></tr>
              </tfoot>
            </table>
          </TableWrap>
          </div>
        </Card>
        <Card title="Order details">
          <dl className="space-y-2.5 text-sm">
            {[
              ["Supplier", supplier ? `${supplier.name}, ${supplier.city}` : "—"],
              ["Contact", supplier ? `${supplier.contactPerson} · ${supplier.phone}` : "—"],
              ["Supplier GSTIN", supplier?.gstin || "—"],
              ["Expected delivery", `${fmtDate(po.expectedDate)}${open ? ` (${dueIn(po.expectedDate).text})` : ""}`],
              ["Last received", fmtDate(po.receivedDate)],
              ["Supplier invoice", po.invoiceNumber || "—"],
              ["Transport", po.transport || "—"],
              ["Notes", po.notes || "—"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <Confirm
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => { const r = setPOStatus(po.id, "Cancelled"); toast(r.ok ? "Order cancelled." : r.error, r.ok ? "success" : "error"); }}
        title="Cancel this order?"
        confirmLabel="Yes, cancel it"
        danger
      >
        {supplier?.name ?? "The supplier"} won&apos;t be expected to deliver these {plural(poUnits(po), "piece")}. Remember to let them know too.
      </Confirm>

      <Modal
        open={!!receiving}
        onClose={() => setReceiving(null)}
        title="What arrived?"
        subtitle="Count the boxes and enter what actually came. Anything missing stays on order."
        wide
        footer={<><Button onClick={() => setReceiving(null)}>Cancel</Button><Button variant="primary" onClick={submitReceive}>Add to stock</Button></>}
      >
        {receiving && (
          <>
            
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Field label="Supplier invoice no."><input className="inp" value={inv} onChange={(e) => setInv(e.target.value)} /></Field>
              <Field label="Note"><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 cartons, 1 damaged" /></Field>
            </div>
            <table className="tbl">
              <thead><tr><th>Product</th><th className="hidden sm:table-cell">Size</th><th className="num">Expected</th><th className="num">Arrived now</th></tr></thead>
              <tbody>
                {po.items.map((it, i) => {
                  const pending = it.qtyOrdered - it.qtyReceived;
                  if (pending <= 0) return null;
                  const p = pmap.get(it.productId);
                  return (
                    <tr key={i}>
                      <td>{p?.name}<div className="text-xs text-muted">{p?.color}<span className="sm:hidden"> · size {it.size}</span></div></td>
                      <td className="hidden sm:table-cell">{it.size}</td>
                      <td className="num">{pending}</td>
                      <td className="num">
                        <input type="number" min={0} max={pending} step={1} inputMode="numeric" aria-label={`${p?.name} size ${it.size} arrived`} className="inp ml-auto w-20 px-2 py-1 text-right" value={receiving[i]}
                          onChange={(e) => setReceiving(receiving.map((q, j) => (j === i ? Math.max(0, Math.min(pending, Math.floor(Number(e.target.value) || 0))) : q)))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </>
  );
}
