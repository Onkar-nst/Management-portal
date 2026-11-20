"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, Clock, CreditCard, Landmark, Minus, Plus, SearchX, ShoppingBag, ShoppingCart, Smartphone, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { CATEGORIES, CHANNELS, type PaymentMethod, type SaleItem, type SalesChannel } from "@/lib/types";
import { Button, Card, ChoiceButtons, ColorDot, Field, MoreDetails, PageHeader, ProductThumb, SearchInput } from "@/components/ui";
import { cn, money, totalStock } from "@/lib/utils";

type CartLine = { productId: string; size: string; qty: number; unitPrice: number; discountPct: number };

export default function POS() {
  const { data, createSale, toast } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [channel, setChannel] = useState<SalesChannel>("Store");
  const [payment, setPayment] = useState<PaymentMethod>("UPI");
  const [gst, setGst] = useState(data.settings.defaultGstPct);
  const [billDiscount, setBillDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [editLine, setEditLine] = useState<number | null>(null);
  const busy = useRef(false); // stops a double-click from making two bills
  const completeRef = useRef<HTMLButtonElement>(null);
  const [completeVisible, setCompleteVisible] = useState(false);
  useEffect(() => {
    const el = completeRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCompleteVisible(e.isIntersecting), { rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pmap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const products = data.products
    .filter((p) => p.active && totalStock(p) > 0)
    .filter((p) => !cat || p.category === cat)
    .filter((p) => !q || [p.name, p.styleCode, p.color, p.brand, ...p.variants.map((v) => v.sku)].some((f) => f.toLowerCase().includes(q.toLowerCase())));

  const inCart = (pid: string, size: string) => cart.find((c) => c.productId === pid && c.size === size)?.qty ?? 0;

  const add = (pid: string, size: string) => {
    const p = pmap.get(pid)!;
    const v = p.variants.find((x) => x.size === size)!;
    if (inCart(pid, size) >= v.stock) return toast(`That's all of them! Only ${v.stock} of ${p.name} in size ${size}.`, "error");
    setCart((c) => {
      const i = c.findIndex((x) => x.productId === pid && x.size === size);
      if (i >= 0) return c.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: pid, size, qty: 1, unitPrice: p.sellingPrice, discountPct: channel === "Wholesale" ? 25 : 0 }];
    });
  };

  const setQty = (i: number, qty: number) => {
    const line = cart[i];
    const stock = pmap.get(line.productId)!.variants.find((v) => v.size === line.size)!.stock;
    if (qty > stock) return toast(`Sorry, only ${stock} left in this size.`, "error");
    setCart((c) => (qty <= 0 ? c.filter((_, j) => j !== i) : c.map((x, j) => (j === i ? { ...x, qty } : x))));
  };

  const lineTotal = (l: CartLine) => l.qty * l.unitPrice * (1 - l.discountPct / 100);
  const gross = cart.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const afterLine = cart.reduce((t, l) => t + lineTotal(l), 0);
  const subtotal = afterLine * (1 - billDiscount / 100);
  const tax = (subtotal * gst) / 100;
  const total = subtotal + tax;
  const units = cart.reduce((t, l) => t + l.qty, 0);

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = data.customers.find((x) => x.id === id);
    setCustomerName(c?.name ?? "");
    setCustomerPhone(c?.phone ?? "");
    if (c?.type === "Wholesale") setChannel("Wholesale");
  };

  const checkout = () => {
    if (busy.current) return;
    if (!cart.length) return toast("The cart is empty. Tap a size to add something.", "error");
    // Fold the bill-level discount into each line so per-line profit stays accurate.
    const items: SaleItem[] = cart.map((l) => {
      const combined = 100 - (100 - l.discountPct) * (1 - billDiscount / 100);
      return {
        productId: l.productId,
        size: l.size,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: Math.round(combined * 100) / 100,
        unitCost: pmap.get(l.productId)!.costPrice,
        returnedQty: 0,
      };
    });
    const r = createSale({
      date: new Date().toISOString(),
      customerId: customerId || undefined,
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone,
      channel,
      paymentMethod: payment,
      gstPct: gst,
      items,
      notes,
    });
    if (!r.ok) return toast(r.error, "error");
    busy.current = true;
    setCart([]);
    router.push(`/sales/${r.id}?done=1`);
  };

  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{n}</span>{children}</span>
  );

  return (
    <>
      <PageHeader title="Make a sale" icon={ShoppingBag} subtitle="Three steps: pick what they're buying, check the bill, and choose how they paid." />
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card pad={false} title={<Step n={1}>Pick what they&apos;re buying</Step>} subtitle="Tap a size to add one piece. The small number is how many are left.">
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search or scan SKU…" />
            <select className="inp w-auto" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto xl:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="rounded-xl border border-line p-3 transition-shadow hover:shadow-md">
                <div className="flex gap-2.5">
                  <ProductThumb p={p} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug" title={p.name}>{p.name}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="flex min-w-0 items-center gap-1.5 truncate"><ColorDot color={p.color} size={8} />{p.color}</span>
                      <span className="shrink-0 text-sm font-bold text-ink">{money(p.sellingPrice)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.variants.map((v) => {
                    const left = v.stock - inCart(p.id, v.size);
                    const picked = inCart(p.id, v.size);
                    return (
                      <button
                        key={v.size}
                        disabled={left <= 0}
                        onClick={() => add(p.id, v.size)}
                        title={`${left} available`}
                        aria-label={`Add ${p.name} size ${v.size} (${left} left${picked ? `, ${picked} in bill` : ""})`}
                        className={cn(
                          "relative min-h-12 min-w-12 rounded-lg border px-2 py-1 text-sm leading-tight transition-colors sm:min-h-0 sm:min-w-10 sm:rounded-md sm:px-1.5 sm:text-xs",
                          left <= 0 ? "cursor-not-allowed border-line text-muted/50 line-through" : picked ? "border-brand bg-brand-soft" : "border-line hover:border-brand hover:bg-brand-soft active:bg-brand-soft",
                        )}
                      >
                        <div className="font-semibold">{v.size}</div>
                        <div className={cn("text-[11px]", left <= p.reorderLevel ? "text-warn" : "text-muted")}>{left}</div>
                        {picked > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-brand px-1 text-[10px] font-bold leading-[18px] text-white" aria-hidden>{picked}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!products.length && <div className="col-span-full py-10 text-center text-sm text-muted"><SearchX size={28} strokeWidth={1.8} className="mx-auto mb-2" aria-hidden />Nothing in stock matches “{q}”.</div>}
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card id="bill" className="scroll-mt-20" title={<Step n={2}>Check the bill · {units} {units === 1 ? "piece" : "pieces"}</Step>} actions={cart.length > 0 && <button className="text-xs font-medium text-muted hover:text-bad" onClick={() => setCart([])}>Empty the bill</button>} pad={false}>
            <div className="max-h-72 divide-y divide-line overflow-y-auto">
              {cart.length === 0 && <div className="p-6 text-center text-sm text-muted"><ShoppingCart size={28} strokeWidth={1.8} className="mx-auto mb-2" aria-hidden />Nothing here yet.<br />Tap a size on the left to add it.</div>}
              {cart.map((l, i) => {
                const p = pmap.get(l.productId)!;
                const editing = editLine === i;
                return (
                  <div key={`${l.productId}-${l.size}`} className="p-3">
                    <div className="flex justify-between gap-2 text-sm">
                      <div className="min-w-0"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-muted">{p.color} · Size {l.size} · {money(l.unitPrice)} each{l.discountPct ? ` · ${l.discountPct}% off` : ""}</div></div>
                      <div className="shrink-0 font-bold tabular-nums">{money(lineTotal(l))}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <div className="flex items-center rounded-lg border border-line">
                        <button className="p-1.5 hover:bg-canvas" onClick={() => setQty(i, l.qty - 1)} aria-label="Decrease"><Minus size={14} /></button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                        <button className="p-1.5 hover:bg-canvas" onClick={() => setQty(i, l.qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                      </div>
                      <button className="font-medium text-brand hover:underline" onClick={() => setEditLine(editing ? null : i)}>{editing ? "Done" : "Change price"}</button>
                      <button className="ml-auto text-muted hover:text-bad" onClick={() => setQty(i, 0)} aria-label={`Remove ${p.name}`}><Trash2 size={15} /></button>
                    </div>
                    {editing && (
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-canvas p-2">
                        <Field label="Price each (₹)"><input type="number" min={0} className="inp py-1 text-sm" value={l.unitPrice} onChange={(e) => setCart((c) => c.map((x, j) => (j === i ? { ...x, unitPrice: Math.max(0, Number(e.target.value) || 0) } : x)))} /></Field>
                        <Field label="Discount %"><input type="number" min={0} max={100} className="inp py-1 text-sm" value={l.discountPct} onChange={(e) => setCart((c) => c.map((x, j) => (j === i ? { ...x, discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x)))} /></Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={<Step n={3}>Customer and payment</Step>}>
            <div className="grid gap-3">
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-ink/80">Paid by</span>
                <ChoiceButtons
                  label="Paid by"
                  value={payment}
                  onChange={setPayment}
                  options={[
                    { value: "Cash", label: "Cash", icon: Banknote },
                    { value: "UPI", label: "UPI", icon: Smartphone },
                    { value: "Card", label: "Card", icon: CreditCard },
                    { value: "Bank Transfer", label: "Bank", icon: Landmark },
                    { value: "Credit", label: "Pay later", icon: Clock },
                  ]}
                />
              </div>
              <Field label="Customer">
                <select className="inp" value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                </select>
              </Field>
              {!customerId && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name (optional)"><input className="inp" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in Customer" /></Field>
                  <Field label="Phone (optional)"><input className="inp" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></Field>
                </div>
              )}
            </div>

            <MoreDetails label="More options (discount, GST, note)">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount on whole bill %"><input type="number" min={0} max={100} className="inp" value={billDiscount} onChange={(e) => setBillDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
                <Field label="GST %">
                  <select className="inp" value={gst} onChange={(e) => setGst(+e.target.value)}>{[0, 5, 12, 18].map((g) => <option key={g} value={g}>{g}%</option>)}</select>
                </Field>
                <Field label="Sold through">
                  <select className="inp" value={channel} onChange={(e) => setChannel(e.target.value as SalesChannel)}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                </Field>
                <Field label="Note"><input className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              </div>
            </MoreDetails>

            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Price of items</dt><dd className="tabular-nums">{money(gross)}</dd></div>
              {gross - subtotal > 0.5 && <div className="flex justify-between"><dt className="text-muted">Customer saves</dt><dd className="tabular-nums font-semibold text-ok">−{money(gross - subtotal)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">GST ({gst}%)</dt><dd className="tabular-nums">{money(tax)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>To pay</dt><dd className="tabular-nums">{money(total)}</dd></div>
            </dl>
            <Button ref={completeRef} variant="primary" className="mt-4 w-full py-3 text-base" disabled={!cart.length} onClick={checkout}><Check size={18} strokeWidth={2.5} aria-hidden /> Complete sale · {money(total)}</Button>
          </Card>
        </div>
      </div>

      {/* Phones/tablets: the bill is below the products, so keep the total within thumb reach. */}
      {cart.length > 0 && !completeVisible && (
        <div className="fixed inset-x-0 z-30 px-3 lg:hidden print:hidden" style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-xl animate-pop items-center gap-3 rounded-2xl bg-ink p-2 pl-4 text-white shadow-2xl">
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-xs text-white/70">{units} {units === 1 ? "piece" : "pieces"} in the bill</div>
              <div className="text-lg font-bold tabular-nums">{money(total)}</div>
            </div>
            <button
              onClick={() => document.getElementById("bill")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex h-12 items-center gap-1.5 rounded-xl bg-brand px-4 font-semibold"
            >
              Review &amp; pay
            </button>
          </div>
        </div>
      )}
      {cart.length > 0 && <div className="h-20 lg:hidden" aria-hidden />}
    </>
  );
}
