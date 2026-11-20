"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Shirt, SearchX, SlidersHorizontal } from "lucide-react";
import { useStore } from "@/lib/store";
import { CATEGORIES, GENDERS, type Product } from "@/lib/types";
import { Button, Card, Empty, PageGuide, PageHeader, ProductCell, SearchInput, Stat, TableWrap } from "@/components/ui";
import { StockBadge } from "@/components/badges";
import { ProductForm } from "@/components/ProductForm";
import { cn, downloadCSV, fmtNum, isLowStock, isOutOfStock, money, totalStock } from "@/lib/utils";

type StockFilter = "all" | "low" | "out" | "in";

/** One small box per size: size on top, pieces left below. Orange = low, red = sold out. */
function SizeChips({ p, className }: { p: Product; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {p.variants.map((v) => (
        <span
          key={v.size}
          title={`${v.sku}: ${v.stock} left`}
          className={cn(
            "inline-flex min-w-11 flex-col items-center rounded-md border px-1.5 py-0.5 text-[11px] leading-tight",
            v.stock === 0 ? "border-bad/30 bg-bad-soft text-bad" : v.stock <= p.reorderLevel ? "border-warn/30 bg-warn-soft text-warn" : "border-line",
          )}
        >
          <span className="text-muted">{v.size}</span>
          <span className="font-semibold tabular-nums">{v.stock}</span>
        </span>
      ))}
    </div>
  );
}

function InventoryInner() {
  const { data } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [gender, setGender] = useState("");
  const [stock, setStock] = useState<StockFilter>((params.get("filter") as StockFilter) || "all");
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState<"name" | "stock" | "value">("name");
  const [adding, setAdding] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);

  useEffect(() => {
    if (params.get("new")) {
      setAdding(true);
      router.replace("/inventory");
    }
  }, [params, router]);

  const supplierName = (id: string) => data.suppliers.find((s) => s.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    return data.products
      .filter((p) => (archived ? !p.active : p.active))
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !gender || p.gender === gender)
      .filter((p) =>
        stock === "low" ? isLowStock(p) : stock === "out" ? p.variants.some((v) => v.stock === 0) : stock === "in" ? !isLowStock(p) : true,
      )
      .filter(
        (p) =>
          !needle ||
          [p.name, p.styleCode, p.brand, p.color, p.fabric, ...p.variants.map((v) => v.sku)].some((f) => f.toLowerCase().includes(needle)),
      )
      .sort((a, b) =>
        sort === "stock"
          ? totalStock(a) - totalStock(b)
          : sort === "value"
            ? totalStock(b) * b.costPrice - totalStock(a) * a.costPrice
            : a.name.localeCompare(b.name),
      );
  }, [data.products, q, cat, gender, stock, archived, sort]);

  const active = data.products.filter((p) => p.active);
  const totals = {
    styles: active.length,
    skus: active.reduce((t, p) => t + p.variants.length, 0),
    units: active.reduce((t, p) => t + totalStock(p), 0),
    value: active.reduce((t, p) => t + totalStock(p) * p.costPrice, 0),
    low: active.filter(isLowStock).length,
    out: active.filter(isOutOfStock).length,
  };

  const exportCSV = () =>
    downloadCSV(
      `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.flatMap((p) =>
        p.variants.map((v) => ({
          SKU: v.sku,
          Product: p.name,
          Category: p.category,
          Gender: p.gender,
          Brand: p.brand,
          Colour: p.color,
          Fabric: p.fabric,
          Size: v.size,
          Stock: v.stock,
          "Cost Price": p.costPrice,
          MRP: p.mrp,
          "Selling Price": p.sellingPrice,
          "Stock Value (Cost)": v.stock * p.costPrice,
          Supplier: supplierName(p.supplierId),
          Location: p.location,
        })),
      ),
    );

  return (
    <>
      <PageHeader
        title="My stock"
        icon={Shirt}
        subtitle="Everything in your shop, and how many of each size are left"
        actions={
          <>
            <Button onClick={exportCSV}><Download size={16} /> Export CSV</Button>
            <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add a product</Button>
          </>
        }
      />

      <PageGuide
        id="inventory"
        steps={[
          <>Each box under a product is one size. The number is <b>how many are left</b>.</>,
          <><b className="text-warn">Orange</b> means running low and <b className="text-bad">red</b> means sold out.</>,
          <>Click a product to see its details, fix a wrong count, or edit it.</>,
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Products" value={totals.styles} hint={`in ${totals.skus} sizes altogether`} />
        <Stat label="Pieces on hand" value={fmtNum(totals.units)} />
        <Stat label="Stock value" value={money(totals.value)} hint="What you paid for it" />
        <Stat label="Need restocking" value={totals.low} tone={totals.low ? "warn" : "ok"} hint={totals.out ? `${totals.out} completely sold out` : "Nothing completely sold out"} />
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, brand, colour…" />
          <select className="inp min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="scroll-x order-last flex w-full gap-1.5 text-sm sm:order-none sm:w-auto sm:gap-0 sm:overflow-hidden sm:rounded-lg sm:border sm:border-line" role="group" aria-label="Show">
            {(["all", "in", "low", "out"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStock(k)}
                aria-pressed={stock === k}
                className={cn("shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 font-medium sm:rounded-none sm:border-0 sm:px-3 sm:py-1.5", stock === k ? "border-ink bg-ink text-white" : "border-line bg-surface hover:bg-canvas")}
              >
                {{ all: "All", in: "Good stock", low: "Running low", out: "Sold-out sizes" }[k]}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="sm:ml-auto" aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)}>
            <SlidersHorizontal size={14} /> {moreFilters ? "Fewer filters" : "More filters"}
          </Button>
        </div>
        {moreFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/40 p-3">
            <select className="inp w-auto" aria-label="Made for" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Men, women &amp; kids</option>
              {GENDERS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="inp w-auto" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="name">Sort: A to Z</option>
              <option value="stock">Sort: Fewest left first</option>
              <option value="value">Sort: Most money tied up</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived products
            </label>
          </div>
        )}

        {rows.length === 0 ? (
          <Empty title={data.products.length ? "Nothing matches those filters" : "No products yet"} icon={data.products.length ? SearchX : Shirt} action={data.products.length ? <Button onClick={() => { setQ(""); setCat(""); setGender(""); setStock("all"); setArchived(false); }}>Show everything</Button> : <Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add your first product</Button>}>
            {data.products.length ? "Try a different search or clear the filters." : "Add the clothes you sell, with sizes and prices, and they'll show up here."}
          </Empty>
        ) : (
          <>
          <ul className="mlist sm:grid-cols-2 xl:hidden" aria-label="Products">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/inventory/${p.id}`} className="mcard">
                  <div className="flex items-start justify-between gap-2">
                    <ProductCell p={p} sub={`${p.color} · ${p.category}`} />
                    <div className="shrink-0 text-right">
                      <div className="font-bold tabular-nums">{money(p.sellingPrice)}</div>
                      <div className="text-xs text-muted">{totalStock(p)} left</div>
                    </div>
                  </div>
                  <SizeChips p={p} className="mt-3" />
                  <div className="mt-2.5"><StockBadge p={p} /></div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden xl:block">
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Pieces left in each size</th>
                  <th className="num">Total</th>
                  <th className="num">Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const t = totalStock(p);
                  return (
                    <tr key={p.id} className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) router.push(`/inventory/${p.id}`); }}>
                      <td className="min-w-60">
                        <ProductCell p={p} href={`/inventory/${p.id}`} sub={`${p.color} · ${p.category} · ${p.gender}`} />
                      </td>
                      <td>
                        <SizeChips p={p} />
                      </td>
                      <td className="num font-semibold">{t}</td>
                      <td className="num whitespace-nowrap font-medium">{money(p.sellingPrice)}</td>
                      <td><StockBadge p={p} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          </div>
          </>
        )}
        <div className="border-t border-line px-5 py-3 text-xs text-muted">Showing {rows.length} of {data.products.filter((p) => (archived ? !p.active : p.active)).length} products · <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warn-soft ring-1 ring-warn/40" /> running low</span> · <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-bad-soft ring-1 ring-bad/40" /> sold out</span></div>
      </Card>

      <ProductForm open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryInner />
    </Suspense>
  );
}
