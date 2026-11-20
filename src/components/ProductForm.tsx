"use client";
import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, IndianRupee, Ruler, Tag } from "lucide-react";
import { useStore } from "@/lib/store";
import { nextStyleCode } from "@/lib/actions";
import { CATEGORIES, GENDERS, SEASONS, SIZE_PRESETS, type Category, type Product } from "@/lib/types";
import { Button, Field, Modal, MoreDetails } from "./ui";

const HSN: Partial<Record<Category, string>> = { "T-Shirts": "6109", Sweaters: "6110", Jackets: "6201", Sarees: "5407", Kidswear: "6111", Accessories: "6217" };

const blank = (supplierId: string): Product => ({
  id: "",
  name: "",
  styleCode: "",
  category: "T-Shirts",
  gender: "Men",
  brand: "",
  color: "",
  fabric: "",
  season: "All Season",
  hsnCode: "6109",
  costPrice: 0,
  mrp: 0,
  sellingPrice: 0,
  reorderLevel: 3,
  supplierId,
  location: "",
  variants: SIZE_PRESETS["Apparel (XS–XXL)"].map((size) => ({ size, sku: "", stock: 0 })),
  createdAt: "",
  active: true,
});

const whole = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const price = (v: string) => Math.max(0, Number(v) || 0);

function Section({ icon: Icon, title, children }: { icon: typeof Tag; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon size={15} className="text-brand" aria-hidden /> {title}</h3>
      {children}
    </section>
  );
}

export function ProductForm({ open, onClose, product, onSaved }: { open: boolean; onClose: () => void; product?: Product; onSaved?: (id: string) => void }) {
  const { data, saveProduct, toast } = useStore();
  const [p, setP] = useState<Product>(product ?? blank(data.suppliers[0]?.id ?? ""));
  const [codeEdited, setCodeEdited] = useState(false);
  const [newSize, setNewSize] = useState("");
  const isNew = !product;
  const busy = useRef(false);

  useEffect(() => {
    if (!open) return;
    busy.current = false;
    setCodeEdited(false);
    setP(product ?? { ...blank(data.suppliers[0]?.id ?? ""), styleCode: nextStyleCode(data, "T-Shirts") });
    // Only reset when the dialog opens, not on every data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const margin = p.sellingPrice > 0 ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100) : 0;

  const setCategory = (c: Category) =>
    setP((x) => ({ ...x, category: c, hsnCode: isNew ? HSN[c] ?? "6204" : x.hsnCode, styleCode: isNew && !codeEdited ? nextStyleCode(data, c) : x.styleCode }));

  const applyPreset = (key: string) => set("variants", SIZE_PRESETS[key].map((size) => ({ size, sku: "", stock: 0 })));

  const addSize = () => {
    const s = newSize.trim().toUpperCase();
    if (!s) return;
    if (p.variants.some((v) => v.size === s)) return toast(`Size ${s} is already on the list.`, "error");
    set("variants", [...p.variants, { size: s, sku: "", stock: 0 }]);
    setNewSize("");
  };

  const submit = () => {
    if (busy.current) return;
    const r = saveProduct({ ...p, sellingPrice: p.sellingPrice || p.mrp });
    if (!r.ok) return toast(r.error, "error");
    busy.current = true;
    toast(isNew ? `${p.name.trim()} added to your stock.` : "Changes saved.");
    onSaved?.(r.id!);
    onClose();
  };

  const totalPieces = p.variants.reduce((t, v) => t + v.stock, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Add a new product" : `Edit ${product?.name}`}
      subtitle={isNew ? "Only the name is required. Everything else can be changed later." : undefined}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{isNew ? "Add product" : "Save changes"}</Button>
        </>
      }
    >
      <Section icon={Tag} title="What is it?">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="What is it called? *" className="sm:col-span-2">
            <input className="inp" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Slim Fit Jeans" autoFocus />
          </Field>
          <Field label="Category">
            <select className="inp" value={p.category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Colour"><input className="inp" value={p.color} onChange={(e) => set("color", e.target.value)} placeholder="e.g. Black" /></Field>
        </div>
      </Section>

      <Section icon={IndianRupee} title="Prices (for one piece)">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="You buy at (₹)" hint="What the supplier charges you"><input type="number" min={0} inputMode="decimal" className="inp" value={p.costPrice || ""} onChange={(e) => set("costPrice", price(e.target.value))} /></Field>
          <Field label="MRP on tag (₹)" hint="Highest price allowed"><input type="number" min={0} inputMode="decimal" className="inp" value={p.mrp || ""} onChange={(e) => set("mrp", price(e.target.value))} /></Field>
          <Field label="You sell at (₹)" hint="Leave empty to sell at MRP"><input type="number" min={0} inputMode="decimal" className="inp" value={p.sellingPrice || ""} placeholder={p.mrp ? String(p.mrp) : ""} onChange={(e) => set("sellingPrice", price(e.target.value))} /></Field>
          <Field label="Your margin" hint="What you keep per piece">
            {(() => {
              const sell = p.sellingPrice || p.mrp;
              const m = sell > 0 ? Math.round(((sell - p.costPrice) / sell) * 100) : margin;
              return <div className={`inp font-semibold ${m < 30 ? "text-warn" : "text-ok"}`}>{sell > 0 ? `${m}% · ₹${Math.max(0, sell - p.costPrice)}` : "—"}</div>;
            })()}
          </Field>
        </div>
      </Section>

      <Section icon={Ruler} title={isNew ? "Sizes, and how many you have right now" : "Sizes"}>
        {isNew && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Size type:</span>
            {Object.keys(SIZE_PRESETS).map((k) => (
              <button key={k} type="button" onClick={() => applyPreset(k)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-canvas">{k}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {p.variants.map((v, i) => (
            <div key={v.size} className="rounded-lg border border-line p-2">
              <div className="mb-1 flex items-center justify-between text-sm font-semibold">
                {v.size}
                {(isNew || !product?.variants.some((x) => x.size === v.size)) && (
                  <button type="button" className="text-muted hover:text-bad" onClick={() => set("variants", p.variants.filter((_, j) => j !== i))} aria-label={`Remove size ${v.size}`}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {isNew ? (
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  aria-label={`Pieces in size ${v.size}`}
                  className="inp px-2 py-1"
                  value={v.stock || ""}
                  placeholder="0"
                  onChange={(e) => set("variants", p.variants.map((x, j) => (j === i ? { ...x, stock: whole(e.target.value) } : x)))}
                />
              ) : (
                <div className="text-xs text-muted">{v.stock} in stock</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="inp max-w-40" value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="Add size e.g. 3XL" onKeyDown={(e) => e.key === "Enter" && addSize()} />
          <Button onClick={addSize}><Plus size={14} /> Add size</Button>
          {isNew && <span className="ml-auto text-sm text-muted">{totalPieces} pieces in total</span>}
        </div>
        {!isNew && <p className="mt-2 text-xs text-muted">To change how many you have, use “Adjust stock” on the product page, record a delivery, or make a sale. That way every change is written in the stock history.</p>}
      </Section>

      <MoreDetails>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Style code" hint="Filled in for you; each size gets its own code from it">
            <input className="inp" value={p.styleCode} onChange={(e) => { setCodeEdited(true); set("styleCode", e.target.value.toUpperCase()); }} />
          </Field>
          <Field label="Made for">
            <select className="inp" value={p.gender} onChange={(e) => set("gender", e.target.value as Product["gender"])}>
              {GENDERS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Supplier">
            <select className="inp" value={p.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
              <option value="">Not set</option>
              {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Brand"><input className="inp" value={p.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Fabric"><input className="inp" value={p.fabric} onChange={(e) => set("fabric", e.target.value)} placeholder="e.g. 100% Cotton" /></Field>
          <Field label="Season">
            <select className="inp" value={p.season} onChange={(e) => set("season", e.target.value as Product["season"])}>
              {SEASONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Where is it kept?"><input className="inp" value={p.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Rack B-2" /></Field>
          <Field label="HSN code" hint="GST category number for the bill"><input className="inp" value={p.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} /></Field>
          <Field label="Warn me when a size drops to" hint="We'll mark it as running low">
            <input type="number" min={0} step={1} className="inp" value={p.reorderLevel} onChange={(e) => set("reorderLevel", whole(e.target.value))} />
          </Field>
        </div>
      </MoreDetails>
    </Modal>
  );
}
