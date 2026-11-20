"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Plus, Printer, Undo2, SearchX, Check, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Card, Empty, Field, Modal } from "@/components/ui";
import { plural, timeAgo } from "@/lib/humanize";
import { fmtDateTime, lineRevenue, money, saleCost, saleProfit, saleSubtotal, saleTax, saleTotal } from "@/lib/utils";

export default function InvoicePage() {
  return <Suspense><Invoice /></Suspense>;
}

function Invoice() {
  const { id } = useParams<{ id: string }>();
  const done = useSearchParams().get("done") === "1";
  const { data, returnSaleItem, toast } = useStore();
  const sale = data.sales.find((s) => s.id === id);
  const [ret, setRet] = useState<{ idx: number; qty: number; reason: string } | null>(null);

  if (!sale) return <Empty title="We couldn't find that bill" icon={SearchX} action={<Link href="/sales"><Button>Back to past sales</Button></Link>} />;

  const pmap = new Map(data.products.map((p) => [p.id, p]));
  const st = data.settings;
  const tax = saleTax(sale);

  const submitReturn = () => {
    if (!ret) return;
    const r = returnSaleItem(sale.id, ret.idx, ret.qty, ret.reason);
    if (!r.ok) return toast(r.error, "error");
    toast(`${plural(ret.qty, "piece")} back in stock. Refund the customer ${money(ret.qty * sale.items[ret.idx].unitPrice * (1 - sale.items[ret.idx].discountPct / 100) * (1 + sale.gstPct / 100))}.`);
    setRet(null);
  };

  return (
    <>
      {done && (
        <div className="mb-5 flex animate-pop flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok/20 bg-ok-soft p-4 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ok text-white" aria-hidden><Check size={22} strokeWidth={2.5} /></span>
            <div>
              <div className="font-bold text-ok">Sale complete! {money(saleTotal(sale))} received by {sale.paymentMethod}.</div>
              <div className="text-sm text-ok/80">Stock has been updated. Print the bill or start the next sale.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}><Printer size={15} /> Print bill</Button>
            <Link href="/pos"><Button variant="primary"><Plus size={15} /> Next sale</Button></Link>
          </div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Past sales</Link>
        <div className="flex gap-2">
          <Button onClick={() => window.print()}><Printer size={15} /> Print invoice</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Card className="print:border-0">
          <div className="flex flex-wrap justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="text-lg font-semibold">{st.companyName}</div>
              <div className="text-sm text-muted">{st.address}</div>
              <div className="text-sm text-muted">GSTIN: {st.gstin}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs uppercase tracking-wide text-muted">Tax invoice</div>
              <h1 className="text-lg font-bold">{sale.invoiceNumber}</h1>
              <div className="text-sm text-muted">{fmtDateTime(sale.date)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-line py-4 text-sm sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1"><div className="text-xs text-muted">Billed to</div><div className="font-medium">{sale.customerName}</div><div className="text-muted">{sale.customerPhone}</div></div>
            <div><div className="text-xs text-muted">Channel</div>{sale.channel}</div>
            <div><div className="text-xs text-muted">Payment</div>{sale.paymentMethod}</div>
          </div>
          <ul className="divide-y divide-line md:hidden print:hidden" aria-label="Items on this bill">
            {sale.items.map((it, i) => {
              const p = pmap.get(it.productId);
              return (
                <li key={i} className="py-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{p?.name ?? "Deleted product"}</div>
                      <div className="text-xs text-muted">{p?.color} · Size {it.size} · HSN {p?.hsnCode}</div>
                      <div className="mt-1 text-sm text-ink/80">
                        {it.qty} × {money(it.unitPrice)}{it.discountPct ? ` · ${it.discountPct}% off` : ""}
                        {it.returnedQty > 0 && <span className="ml-1.5 text-info">(−{it.returnedQty} returned)</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-bold tabular-nums">{money(lineRevenue(it))}</div>
                  </div>
                  {it.qty - it.returnedQty > 0 && (
                    <Button size="sm" className="mt-2" onClick={() => setRet({ idx: i, qty: 1, reason: "" })}><Undo2 size={13} /> Return</Button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block print:block">
            <table className="tbl">
              <thead>
                <tr><th>#</th><th>Item</th><th>HSN</th><th>Size</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Disc.</th><th className="num">Amount</th><th className="print:hidden"><span className="sr-only">Return</span></th></tr>
              </thead>
              <tbody>
                {sale.items.map((it, i) => {
                  const p = pmap.get(it.productId);
                  return (
                    <tr key={i}>
                      <td className="text-muted">{i + 1}</td>
                      <td>{p?.name ?? "Deleted product"}<div className="text-xs text-muted">{p?.color} · {p?.styleCode}-{it.size}</div></td>
                      <td className="text-muted">{p?.hsnCode}</td>
                      <td>{it.size}</td>
                      <td className="num">{it.qty}{it.returnedQty > 0 && <div className="text-xs text-info">−{it.returnedQty} returned</div>}</td>
                      <td className="num">{money(it.unitPrice)}</td>
                      <td className="num">{it.discountPct ? `${it.discountPct}%` : "—"}</td>
                      <td className="num font-medium">{money(lineRevenue(it))}</td>
                      <td className="num print:hidden">
                        {it.qty - it.returnedQty > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setRet({ idx: i, qty: 1, reason: "" })}><Undo2 size={13} /> Return</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 space-y-1.5 text-sm sm:ml-auto sm:max-w-xs">
            <div className="flex justify-between"><dt className="text-muted">Taxable value</dt><dd className="tabular-nums">{money(saleSubtotal(sale))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">CGST ({sale.gstPct / 2}%)</dt><dd className="tabular-nums">{money(tax / 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">SGST ({sale.gstPct / 2}%)</dt><dd className="tabular-nums">{money(tax / 2)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(saleTotal(sale))}</dd></div>
          </dl>
          {sale.notes && <p className="mt-4 text-sm text-muted">Note: {sale.notes}</p>}
          <p className="mt-6 text-center text-xs text-muted">Thank you for shopping with us. Exchanges within 7 days with invoice.</p>
        </Card>

        <div className="space-y-4 print:hidden">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={sale.customerName} size={44} />
              <div>
                <div className="font-semibold">{sale.customerName}</div>
                <div className="text-xs text-muted">{sale.customerPhone || "No phone saved"} · {timeAgo(sale.date)}</div>
              </div>
            </div>
          </Card>
          <Card title="Just for you" icon={Lock}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">You paid for these</dt><dd>{money(saleCost(sale))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Your profit</dt><dd className="font-semibold text-ok">{money(saleProfit(sale))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Margin</dt><dd>{saleSubtotal(sale) ? Math.round((saleProfit(sale) / saleSubtotal(sale)) * 100) : 0}%</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">This box isn't printed on the bill.</p>
          </Card>
        </div>
      </div>

      <Modal
        open={!!ret}
        onClose={() => setRet(null)}
        title="Customer is returning something"
        subtitle="The pieces go back on the shelf and the bill is adjusted"
        footer={<><Button onClick={() => setRet(null)}>Cancel</Button><Button variant="primary" onClick={submitReturn}>Return to stock</Button></>}
      >
        {ret && (() => {
          const it = sale.items[ret.idx];
          const p = pmap.get(it.productId);
          return (
            <div className="grid gap-4">
              <p className="text-sm">{p?.name} · Size {it.size} — {it.qty - it.returnedQty} returnable</p>
              <Field label="Quantity"><input type="number" min={1} max={it.qty - it.returnedQty} className="inp" value={ret.qty} onChange={(e) => setRet({ ...ret, qty: +e.target.value })} /></Field>
              <Field label="Why? (optional)"><input className="inp" value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} placeholder="e.g. Size too small, exchanged" /></Field>
              <p className="text-xs text-muted">Units go back into stock and the invoice total is reduced. Refund {money(ret.qty * it.unitPrice * (1 - it.discountPct / 100) * (1 + sale.gstPct / 100))}.</p>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
