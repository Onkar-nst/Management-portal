"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Inbox, PackageCheck, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { POItem } from "@/lib/types";
import { cn, dateInput, money } from "@/lib/utils";
import { Button, Field, Modal, MoreDetails } from "./ui";
import { ProductForm } from "./ProductForm";

type Line = { productId: string; qty: Record<string, number>; unitCost: number };
export type POMode = "arrived" | "ordered";

const whole = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

export function POForm({ open, onClose, onCreated, initialMode = "ordered" }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void; initialMode?: POMode }) {
  const { data, createPurchaseOrder, receivePurchaseOrder, toast } = useStore();
  const [mode, setMode] = useState<POMode>(initialMode);
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(dateInput());
  const [expectedDate, setExpectedDate] = useState(dateInput(new Date(Date.now() + 7 * 86_400_000).toISOString()));
  const [transport, setTransport] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [onlySupplier, setOnlySupplier] = useState(true);
  const [newProduct, setNewProduct] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const busy = useRef(false); // stops a double-click from saving twice

  useEffect(() => {
    if (!open) return;
    busy.current = false;
    setMode(initialMode);
    setSupplierId(data.suppliers[0]?.id ?? "");
    setLines([]);
    setNotes("");
    setTransport("");
    setInvoiceNumber("");
    setOrderDate(dateInput());
    setExpectedDate(dateInput(new Date(Date.now() + 7 * 86_400_000).toISOString()));
    // Only reset when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pmap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const choices = data.products.filter((p) => p.active && (!onlySupplier || p.supplierId === supplierId) && !lines.some((l) => l.productId === p.id));
  const arrived = mode === "arrived";

  const addLine = (id: string) => {
    const p = pmap.get(id);
    if (!p) return;
    setLines((ls) => [...ls, { productId: id, qty: Object.fromEntries(p.variants.map((v) => [v.size, 0])), unitCost: p.costPrice }]);
  };

  useEffect(() => {
    if (pendingId && pmap.has(pendingId)) {
      addLine(pendingId);
      setPendingId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId, pmap]);

  const totalUnits = lines.reduce((t, l) => t + Object.values(l.qty).reduce((a, b) => a + b, 0), 0);
  const totalValue = lines.reduce((t, l) => t + Object.values(l.qty).reduce((a, b) => a + b, 0) * l.unitCost, 0);

  const submit = () => {
    if (busy.current) return;
    const items: POItem[] = lines.flatMap((l) =>
      Object.entries(l.qty)
        .filter(([, q]) => q > 0)
        .map(([size, q]) => ({ productId: l.productId, size, qtyOrdered: q, qtyReceived: 0, unitCost: l.unitCost })),
    );
    const today = new Date().toISOString();
    const r = createPurchaseOrder({
      supplierId,
      status: "Ordered",
      orderDate: arrived ? today : new Date(orderDate).toISOString(),
      expectedDate: arrived ? today : new Date(expectedDate).toISOString(),
      transport,
      invoiceNumber,
      notes,
      items,
    });
    if (!r.ok) return toast(r.error, "error");
    busy.current = true;
    if (arrived) {
      const rr = receivePurchaseOrder(r.id!, items.map((i) => i.qtyOrdered), invoiceNumber, "Received on entry");
      if (!rr.ok) return toast(rr.error, "error");
      toast(`${totalUnits} pieces added to your stock.`);
    } else {
      toast("Order saved. It stays under Deliveries until the goods arrive.");
    }
    onCreated?.(r.id!);
    onClose();
  };

  const ModeCard = ({ value, icon: Icon, title, sub }: { value: POMode; icon: typeof PackageCheck; title: string; sub: string }) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={cn("flex flex-1 items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors", mode === value ? "border-brand bg-brand-soft/60" : "border-line hover:bg-canvas")}
    >
      <Icon size={22} className={mode === value ? "text-brand" : "text-muted"} aria-hidden />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      <Modal
        open={open && !newProduct}
        onClose={onClose}
        title={arrived ? "Record stock that arrived" : "Order stock from a supplier"}
        wide
        footer={
          <>
            <span className="mr-auto self-center text-sm text-muted max-sm:w-full max-sm:text-center"><b className="text-ink">{totalUnits}</b> pieces · <b className="text-ink">{money(totalValue)}</b></span>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={submit}>{arrived ? "Save & add to stock" : "Save order"}</Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Has the stock arrived?" className="flex flex-col gap-2 sm:flex-row">
          <ModeCard value="arrived" icon={PackageCheck} title="The stock has arrived" sub="It's in the shop now. Add it to stock straight away." />
          <ModeCard value="ordered" icon={CalendarClock} title="I've ordered it, it hasn't come yet" sub="Keep track of it until it arrives." />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Supplier *">
            <select className="inp" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {!arrived && (
            <>
              <Field label="Order date"><input type="date" className="inp" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
              <Field label="Expected delivery"><input type="date" className="inp" value={expectedDate} min={orderDate} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
            </>
          )}
        </div>

        <h3 className="mb-2 mt-5 text-sm font-bold">What {arrived ? "came" : "did you order"}?</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select className="inp max-w-sm" aria-label="Choose a product to add" value="" onChange={(e) => addLine(e.target.value)}>
            <option value="">+ Choose a product to add…</option>
            {choices.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.color})</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={onlySupplier} onChange={(e) => setOnlySupplier(e.target.checked)} /> Only this supplier&apos;s products
          </label>
          <Button size="sm" variant="ghost" onClick={() => setNewProduct(true)}><Plus size={14} /> A product that isn&apos;t listed</Button>
        </div>

        <div className="mt-3 space-y-3">
          {lines.length === 0 && (
            <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
              <Inbox size={24} strokeWidth={1.8} className="mx-auto mb-2" aria-hidden />Nothing added yet. Choose a product above, then type how many of each size.
            </div>
          )}
          {lines.map((l, li) => {
            const p = pmap.get(l.productId)!;
            const units = Object.values(l.qty).reduce((a, b) => a + b, 0);
            return (
              <div key={l.productId} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">{p.color} · now in stock: {p.variants.reduce((t, v) => t + v.stock, 0)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      Price each ₹
                      <input type="number" min={0} className="inp w-24 px-2 py-1" value={l.unitCost} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === li ? { ...x, unitCost: Math.max(0, Number(e.target.value) || 0) } : x)))} />
                    </label>
                    <span className="w-28 text-right text-sm tabular-nums">{units} pcs · {money(units * l.unitCost)}</span>
                    <button className="p-1 text-muted hover:text-bad" onClick={() => setLines((ls) => ls.filter((_, i) => i !== li))} aria-label={`Remove ${p.name}`}><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.variants.map((v) => (
                    <label key={v.size} className="w-16 text-center">
                      <span className="block text-xs font-semibold">{v.size}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        aria-label={`${p.name} size ${v.size}`}
                        className="inp px-1 py-1 text-center"
                        value={l.qty[v.size] || ""}
                        placeholder="0"
                        onChange={(e) => setLines((ls) => ls.map((x, i) => (i === li ? { ...x, qty: { ...x.qty, [v.size]: whole(e.target.value) } } : x)))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <MoreDetails label="More details (bill number, transport, note)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Supplier invoice no."><input className="inp" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
            <Field label="Transport / LR no."><input className="inp" value={transport} onChange={(e) => setTransport(e.target.value)} /></Field>
            <Field label="Notes"><input className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        </MoreDetails>
      </Modal>
      <ProductForm open={newProduct} onClose={() => setNewProduct(false)} onSaved={(id) => { setOnlySupplier(false); setPendingId(id); }} />
    </>
  );
}
