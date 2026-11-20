"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Archive, Pencil, SlidersHorizontal, Trash2, ArchiveRestore, SearchX, Truck, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import type { MovementType } from "@/lib/types";
import { Badge, Button, Card, ColorDot, Confirm, Empty, Field, Modal, ProductThumb, Stat, TableWrap } from "@/components/ui";
import { MovementBadge, POStatusBadge, StockBadge } from "@/components/badges";
import { dueIn, plural, timeAgo } from "@/lib/humanize";
import { ProductForm } from "@/components/ProductForm";
import { daysAgo, fmtDate, fmtDateTime, lineNetQty, lineRevenue, money, totalStock } from "@/lib/utils";

const ADJ_TYPES: { type: MovementType; sign: 1 | -1 | 0; label: string }[] = [
  { type: "Adjustment", sign: 0, label: "I counted and the number is different (+/−)" },
  { type: "Damaged", sign: -1, label: "Damaged or defective pieces (remove)" },
  { type: "Return to Supplier", sign: -1, label: "Sending back to the supplier (remove)" },
  { type: "Customer Return", sign: 1, label: "Customer returned it without a bill (add)" },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, adjustStock, setProductActive, deleteProduct, toast } = useStore();
  const p = data.products.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [adj, setAdj] = useState<{ size: string; type: MovementType; qty: number; note: string } | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const stats = useMemo(() => {
    if (!p) return null;
    let units = 0, units30 = 0, revenue = 0, returned = 0;
    const bySize = new Map<string, number>();
    const lines: { saleId: string; invoice: string; date: string; customer: string; size: string; qty: number; amount: number }[] = [];
    for (const s of data.sales)
      for (const it of s.items) {
        if (it.productId !== p.id) continue;
        const n = lineNetQty(it);
        units += n;
        returned += it.returnedQty;
        revenue += lineRevenue(it);
        if (daysAgo(s.date) < 30) units30 += n;
        bySize.set(it.size, (bySize.get(it.size) ?? 0) + n);
        lines.push({ saleId: s.id, invoice: s.invoiceNumber, date: s.date, customer: s.customerName, size: it.size, qty: n, amount: lineRevenue(it) });
      }
    const received = data.movements.filter((m) => m.productId === p.id && (m.type === "Purchase In" || m.type === "Opening Stock")).reduce((t, m) => t + m.qty, 0);
    const sellThrough = received ? Math.round((units / received) * 100) : 0;
    const stock = totalStock(p);
    const cover = units30 ? Math.round((stock / units30) * 30) : null;
    return { units, units30, revenue, returned, bySize, lines, sellThrough, cover };
  }, [p, data.sales, data.movements]);

  if (!p || !stats) return <Empty title="We couldn't find that product" icon={SearchX} action={<Link href="/inventory"><Button>Back to my stock</Button></Link>}>It may have been deleted.</Empty>;

  const moves = data.movements.filter((m) => m.productId === p.id);
  const openPOs = data.purchaseOrders.filter((po) => ["Ordered", "In Transit", "Partially Received"].includes(po.status) && po.items.some((i) => i.productId === p.id));
  const incomingBySize = new Map<string, number>();
  openPOs.forEach((po) => po.items.filter((i) => i.productId === p.id).forEach((i) => incomingBySize.set(i.size, (incomingBySize.get(i.size) ?? 0) + i.qtyOrdered - i.qtyReceived)));
  const supplier = data.suppliers.find((s) => s.id === p.supplierId);
  const margin = p.sellingPrice ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100) : 0;

  const submitAdj = () => {
    if (!adj) return;
    const meta = ADJ_TYPES.find((t) => t.type === adj.type)!;
    const delta = meta.sign === 0 ? adj.qty : meta.sign * Math.abs(adj.qty);
    const r = adjustStock(p.id, adj.size, delta, adj.type, adj.note);
    if (!r.ok) return toast(r.error, "error");
    toast(`Got it! ${p.name} (${adj.size}) ${delta > 0 ? "increased" : "reduced"} by ${Math.abs(delta)}.`);
    setAdj(null);
  };

  const onDelete = () => {
    const r = deleteProduct(p.id);
    if (!r.ok) return toast(r.error, "error");
    toast(`${p.name} has been deleted.`);
    router.push("/inventory");
  };

  return (
    <>
      <Link href="/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> My stock</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProductThumb p={p} size={64} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><ColorDot color={p.color} /> {p.color}</span>· {p.fabric} · {p.brand} · <span className="font-mono text-xs">{p.styleCode}</span>
              <StockBadge p={p} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setAdj({ size: p.variants[0]?.size ?? "", type: "Adjustment", qty: 0, note: "" })}><SlidersHorizontal size={15} /> Adjust stock</Button>
          <Button onClick={() => setEditing(true)}><Pencil size={15} /> Edit</Button>
          {p.active ? (
            <Button onClick={() => setConfirm("archive")}><Archive size={15} /> Archive</Button>
          ) : (
            <Button onClick={() => { setProductActive(p.id, true); toast(`${p.name} is back in your active products.`); }}><ArchiveRestore size={15} /> Restore</Button>
          )}
          <Button variant="danger" onClick={() => setConfirm("delete")} aria-label="Delete product"><Trash2 size={15} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Pieces left" value={totalStock(p)} hint={`You paid ${money(totalStock(p) * p.costPrice)}`} />
        <Stat label="Sold so far" value={stats.units} hint={`${stats.units30} in the last 30 days`} />
        <Stat label="Money earned" value={money(stats.revenue)} hint={stats.returned ? `${plural(stats.returned, "piece")} came back` : "before GST"} />
        <Stat label="Sell-through" value={`${stats.sellThrough}%`} hint="of all stock bought has sold" help="Out of every 100 pieces you bought, how many have sold. Higher is better." />
        <Stat label="Lasts about" value={stats.cover === null ? "—" : `${stats.cover} days`} hint={stats.cover === null ? "No recent sales" : "at the current selling pace"} tone={stats.cover !== null && stats.cover < 14 ? "warn" : undefined} help="If you keep selling at the pace of the last 30 days, this is roughly when you will run out." />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Stock in each size" className="xl:col-span-2" pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr><th>Size</th><th className="hidden sm:table-cell">SKU</th><th className="num">Left</th><th className="num">Coming</th><th className="num max-[359px]:hidden">Sold</th><th><span className="sr-only">Adjust</span></th></tr>
              </thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.size}>
                    <td className="font-medium">{v.size}</td>
                    <td className="hidden sm:table-cell font-mono text-xs text-muted">{v.sku}</td>
                    <td className="num">
                      {v.stock === 0 ? <Badge tone="bad">Sold out</Badge> : v.stock <= p.reorderLevel ? <Badge tone="warn">only {v.stock}</Badge> : <span className="font-semibold">{v.stock}</span>}
                    </td>
                    <td className="num text-info">{incomingBySize.get(v.size) || "—"}</td>
                    <td className="num text-muted max-[359px]:hidden">{stats.bySize.get(v.size) ?? 0}</td>
                    <td className="num">
                      <Button size="sm" variant="ghost" aria-label={`Adjust size ${v.size}`} onClick={() => setAdj({ size: v.size, type: "Adjustment", qty: 0, note: "" })}><SlidersHorizontal size={14} /><span className="hidden sm:inline">Adjust</span></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card title="About this product">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
            {[
              ["Category", `${p.category} · ${p.gender}`],
              ["Season", p.season],
              ["Cost price", money(p.costPrice)],
              ["MRP", money(p.mrp)],
              ["Selling price", money(p.sellingPrice)],
              ["Margin", `${margin}%`],
              ["HSN", p.hsnCode],
              ["Location", p.location || "—"],
              ["Warn me when", `${p.reorderLevel} or fewer left in a size`],
              ["Added", fmtDate(p.createdAt)],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>
            ))}
            <div className="col-span-2"><dt className="text-xs text-muted">Supplier</dt><dd>{supplier ? <Link href="/suppliers" className="hover:text-brand">{supplier.name}, {supplier.city}</Link> : "—"}</dd></div>
          </dl>
        </Card>
      </div>

      {openPOs.length > 0 && (
        <Card title="More of this is on the way" icon={Truck} className="mt-4" pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Order</th><th>Expected</th><th>Sizes coming</th><th className="hidden sm:table-cell">Status</th></tr></thead>
              <tbody>
                {openPOs.map((po) => (
                  <tr key={po.id}>
                    <td className="whitespace-nowrap"><Link href={`/purchases/${po.id}`} className="font-medium hover:text-brand">{po.poNumber}</Link></td>
                    <td>{fmtDate(po.expectedDate)} <span className={`block text-xs sm:inline ${dueIn(po.expectedDate).late ? "text-bad" : "text-muted"}`}>({dueIn(po.expectedDate).text})</span></td>
                    <td className="text-sm">{po.items.filter((i) => i.productId === p.id && i.qtyOrdered > i.qtyReceived).map((i) => `${i.size}×${i.qtyOrdered - i.qtyReceived}`).join(", ")}</td>
                    <td className="hidden sm:table-cell"><POStatusBadge status={po.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Stock history" subtitle="Every time the count changed, and why" pad={false}>
          <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="Stock history for this product">
            <table className="tbl">
              <thead><tr><th className="hidden sm:table-cell">When</th><th>What happened</th><th>Size</th><th className="num">Pieces</th><th className="hidden sm:table-cell">Ref</th></tr></thead>
              <tbody>
                {moves.slice(0, 100).map((m) => (
                  <tr key={m.id}>
                    <td className="hidden sm:table-cell whitespace-nowrap text-muted" title={fmtDateTime(m.date)}>{timeAgo(m.date)}</td>
                    <td><MovementBadge type={m.type} /><div className="mt-0.5 text-xs text-muted sm:hidden">{timeAgo(m.date)}{m.note && ` · ${m.note}`}</div></td>
                    <td>{m.size}</td>
                    <td className={`num font-medium ${m.qty > 0 ? "text-ok" : "text-bad"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                    <td className="hidden sm:table-cell break-all text-xs text-muted">{m.reference}{m.note && <div>{m.note}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Who bought it" pad={false}>
          <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="Sales of this product">
            {stats.lines.length === 0 ? (
              <Empty title="Not sold yet" icon={Clock}>Its first sale will show up here.</Empty>
            ) : (
              <table className="tbl">
                <thead><tr><th>Bill</th><th className="hidden sm:table-cell">Date</th><th>Size</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {stats.lines.map((l, i) => (
                    <tr key={i}>
                      <td><Link href={`/sales/${l.saleId}`} className="hover:text-brand">{l.invoice}</Link><div className="text-xs text-muted">{l.customer}<span className="sm:hidden"> · {fmtDate(l.date)}</span></div></td>
                      <td className="hidden sm:table-cell whitespace-nowrap text-muted">{fmtDate(l.date)}</td>
                      <td>{l.size}</td>
                      <td className="num">{l.qty}</td>
                      <td className="num">{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      <ProductForm open={editing} onClose={() => setEditing(false)} product={p} />

      <Confirm
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        onConfirm={() => { setProductActive(p.id, false); toast(`${p.name} archived. You can restore it any time.`); }}
        title={`Archive ${p.name}?`}
        confirmLabel="Yes, archive it"
      >
        It will be hidden from inventory and the sale screen, but its sales history stays. You can bring it back any time from the “Archived” filter.
      </Confirm>
      <Confirm
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title={`Delete ${p.name} permanently?`}
        confirmLabel="Delete forever"
        danger
      >
        This can&apos;t be undone. Products that have already been sold or ordered can&apos;t be deleted. Archive them instead.
      </Confirm>

      <Modal
        open={!!adj}
        onClose={() => setAdj(null)}
        title="Adjust stock"
        subtitle="Use this when the real count doesn't match, or pieces are damaged"
        footer={<><Button onClick={() => setAdj(null)}>Cancel</Button><Button variant="primary" onClick={submitAdj}>Save adjustment</Button></>}
      >
        {adj && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Size">
                <select className="inp" value={adj.size} onChange={(e) => setAdj({ ...adj, size: e.target.value })}>
                  {p.variants.map((v) => <option key={v.size} value={v.size}>{v.size} ({v.stock} on hand)</option>)}
                </select>
              </Field>
              <Field label={ADJ_TYPES.find((t) => t.type === adj.type)!.sign === 0 ? "Change (+ add / − remove)" : "Quantity"}>
                <input type="number" className="inp" value={adj.qty || ""} onChange={(e) => setAdj({ ...adj, qty: +e.target.value })} />
              </Field>
            </div>
            <Field label="What happened?">
              <select className="inp" value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value as MovementType })}>
                {ADJ_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Note"><input className="inp" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="e.g. Counted the shelf this morning" /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
