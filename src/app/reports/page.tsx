"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, BarChart3, Ruler, ShoppingCart, Snail } from "lucide-react";
import { useStore } from "@/lib/store";
import { BarList, Button, Card, PageHeader, ProductCell, Stat, TableWrap } from "@/components/ui";
import { cn, daysAgo, downloadCSV, fmtNum, lineCost, lineNetQty, lineRevenue, money, saleTax, totalStock } from "@/lib/utils";

const PERIOD_TEXT: Record<string, string> = { "7": "the last 7 days", "30": "the last 30 days", "90": "the last 90 days", all: "your records" };
const PERIOD_START: Record<string, string> = { "7": "In the last 7 days", "30": "In the last 30 days", "90": "In the last 90 days", all: "Since you started" };
const LEAD_DAYS = 14; // typical supplier lead time
const COVER_DAYS = 30; // target stock cover after reorder

export default function Reports() {
  const { data } = useStore();
  const [period, setPeriod] = useState("30");
  const pmap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const r = useMemo(() => {
    const sales = data.sales.filter((s) => period === "all" || daysAgo(s.date) < +period);
    let revenue = 0, cost = 0, discount = 0, units = 0, returns = 0;
    const gst = sales.reduce((t, s) => t + saleTax(s), 0);
    type Agg = { units: number; revenue: number; cost: number };
    const blank = (): Agg => ({ units: 0, revenue: 0, cost: 0 });
    const byCat = new Map<string, Agg>();
    const bySize = new Map<string, Agg>();
    const byBrand = new Map<string, Agg>();
    const byChannel = new Map<string, Agg>();
    const byPayment = new Map<string, number>();
    const add = (m: Map<string, Agg>, k: string, u: number, rv: number, c: number) => {
      const a = m.get(k) ?? blank();
      a.units += u; a.revenue += rv; a.cost += c;
      m.set(k, a);
    };
    for (const s of sales) {
      let billRev = 0;
      for (const it of s.items) {
        const p = pmap.get(it.productId);
        const u = lineNetQty(it), rv = lineRevenue(it), c = lineCost(it);
        revenue += rv; cost += c; units += u; returns += it.returnedQty;
        discount += u * it.unitPrice * (it.discountPct / 100);
        billRev += rv;
        add(byCat, p?.category ?? "Other", u, rv, c);
        add(bySize, it.size, u, rv, c);
        add(byBrand, p?.brand ?? "Other", u, rv, c);
        add(byChannel, s.channel, u, rv, c);
      }
      byPayment.set(s.paymentMethod, (byPayment.get(s.paymentMethod) ?? 0) + billRev);
    }

    // Velocity per variant over last 30 days for reorder suggestions.
    const sold30 = new Map<string, number>();
    const lastSold = new Map<string, string>();
    for (const s of data.sales) {
      for (const it of s.items) {
        if (daysAgo(s.date) < 30) sold30.set(`${it.productId}|${it.size}`, (sold30.get(`${it.productId}|${it.size}`) ?? 0) + lineNetQty(it));
        if ((lastSold.get(it.productId) ?? "") < s.date) lastSold.set(it.productId, s.date);
      }
    }
    const incoming = new Map<string, number>();
    for (const po of data.purchaseOrders)
      if (["Ordered", "In Transit", "Partially Received"].includes(po.status))
        for (const it of po.items) incoming.set(`${it.productId}|${it.size}`, (incoming.get(`${it.productId}|${it.size}`) ?? 0) + it.qtyOrdered - it.qtyReceived);

    const reorder = data.products
      .filter((p) => p.active)
      .flatMap((p) =>
        p.variants.map((v) => {
          const key = `${p.id}|${v.size}`;
          const perDay = (sold30.get(key) ?? 0) / 30;
          const inc = incoming.get(key) ?? 0;
          const target = Math.ceil(perDay * (LEAD_DAYS + COVER_DAYS)) + p.reorderLevel;
          const suggest = Math.max(0, target - v.stock - inc);
          return { p, v, perDay, inc, suggest, daysLeft: perDay ? Math.floor(v.stock / perDay) : null };
        }),
      )
      .filter((x) => x.suggest > 0 && (x.perDay > 0 || x.v.stock <= x.p.reorderLevel))
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));

    const slow = data.products
      .filter((p) => p.active && totalStock(p) > 0)
      .map((p) => ({ p, last: lastSold.get(p.id), idle: lastSold.get(p.id) ? daysAgo(lastSold.get(p.id)!) : daysAgo(p.createdAt), value: totalStock(p) * p.costPrice }))
      .filter((x) => x.idle >= 21)
      .sort((a, b) => b.value - a.value);

    const valuation = new Map<string, { units: number; cost: number; retail: number }>();
    for (const p of data.products.filter((x) => x.active)) {
      const a = valuation.get(p.category) ?? { units: 0, cost: 0, retail: 0 };
      const t = totalStock(p);
      a.units += t; a.cost += t * p.costPrice; a.retail += t * p.sellingPrice;
      valuation.set(p.category, a);
    }

    const sortRev = (m: Map<string, Agg>) => [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
    return {
      bills: sales.length, revenue, cost, discount, units, returns, gst,
      byCat: sortRev(byCat), bySize: [...bySize.entries()].sort((a, b) => b[1].units - a[1].units), byBrand: sortRev(byBrand), byChannel: sortRev(byChannel),
      byPayment: [...byPayment.entries()].sort((a, b) => b[1] - a[1]),
      reorder, slow, valuation: [...valuation.entries()].sort((a, b) => b[1].cost - a[1].cost),
    };
  }, [data, period, pmap]);

  const profit = r.revenue - r.cost;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <>
      <PageHeader
        title="Reports"
        icon={BarChart3}
        subtitle="How the business is doing: profit, what sells, what doesn't, and what to reorder"
        actions={
          <select className="inp w-auto" aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        }
      />

      <Card className="mb-4">
        <p className="text-[15px] leading-relaxed" data-testid="report-summary">
          {r.bills === 0 ? (
            <>No sales in {PERIOD_TEXT[period]} yet.</>
          ) : (
            <>
              <b>{PERIOD_START[period]}</b>, you made <b>{r.bills} sales</b> and sold <b>{fmtNum(r.units)} pieces</b> for <b>{money(r.revenue)}</b>.
              After paying suppliers for those pieces, you kept <b className="text-ok">{money(profit)}</b> ({pct(profit, r.revenue)}).
              {r.byCat[0] && <> Your best category was <b>{r.byCat[0][0]}</b>{r.bySize[0] && <>, and size <b>{r.bySize[0][0]}</b> sold the most</>}.</>}
              {r.reorder.length > 0 && <> <a href="#reorder" className="font-semibold text-brand hover:underline">{r.reorder.length} sizes need reordering.</a></>}
            </>
          )}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Sales" value={money(r.revenue)} hint={`${r.bills} bills · before GST`} help="Total of all bills, after discounts and returns, not counting GST." />
        <Stat label="Cost of what sold" value={money(r.cost)} help="What you originally paid suppliers for the pieces that sold." />
        <Stat label="Profit" value={money(profit)} tone="ok" hint={`${pct(profit, r.revenue)} of sales`} help="Sales minus the cost of what sold. Rent, salaries and other expenses are not included." />
        <Stat label="Discounts given" value={money(r.discount)} hint={`${fmtNum(r.units)} pieces sold`} />
        <Stat label="GST to pay" value={money(r.gst)} hint={`${r.returns} pieces returned`} help="GST collected on sales in this period." />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Which categories make money" pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Category</th><th className="num hidden sm:table-cell">Pieces</th><th className="num">Sales</th><th className="num">Profit</th><th className="num max-[359px]:hidden">Margin</th></tr></thead>
              <tbody>
                {r.byCat.map(([k, a]) => (
                  <tr key={k}><td>{k}</td><td className="num hidden sm:table-cell">{a.units}</td><td className="num">{money(a.revenue)}</td><td className="num text-ok">{money(a.revenue - a.cost)}</td><td className="num max-[359px]:hidden">{pct(a.revenue - a.cost, a.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card title="Which sizes sell most" subtitle="Use this to decide how many of each size to order" icon={Ruler}>
          <BarList rows={r.bySize.slice(0, 12).map(([k, a]) => ({ label: k, value: a.units }))} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Where you sell">
          <BarList rows={r.byChannel.map(([k, a]) => ({ label: k, value: a.revenue, sub: pct(a.revenue - a.cost, a.revenue) + " margin" }))} format={money} />
        </Card>
        <Card title="How people pay">
          <BarList rows={r.byPayment.map(([k, v]) => ({ label: k, value: v }))} format={money} />
        </Card>
        <Card title="Brands">
          <BarList rows={r.byBrand.map(([k, a]) => ({ label: k, value: a.revenue }))} format={money} />
        </Card>
      </div>

      <Card
        id="reorder"
        className="mt-4 scroll-mt-6"
        title="What to reorder"
        icon={ShoppingCart}
        pad={false}
        actions={
          <Button size="sm" onClick={() => downloadCSV("reorder-suggestions.csv", r.reorder.map((x) => ({ SKU: x.v.sku, Product: x.p.name, Colour: x.p.color, Size: x.v.size, "In stock": x.v.stock, Incoming: x.inc, "Sold/day": x.perDay.toFixed(2), "Days left": x.daysLeft ?? "", "Suggested qty": x.suggest, Supplier: data.suppliers.find((s) => s.id === x.p.supplierId)?.name ?? "" })))}>
            <Download size={13} /> CSV
          </Button>
        }
      >
        <p className="border-b border-line px-4 py-2.5 text-xs text-muted">
          We look at how fast each size sold in the last 30 days. Suppliers usually take about {LEAD_DAYS} days to deliver, so we suggest enough for {COVER_DAYS} days after that, minus what you already have or have on order.
        </p>
        <ul className="mlist sm:grid-cols-2 xl:hidden" aria-label="What to reorder">
          {r.reorder.slice(0, 25).map((x) => (
            <li key={x.v.sku} className="mcard">
              <div className="flex items-start justify-between gap-3">
                <ProductCell p={x.p} href={`/inventory/${x.p.id}`} sub={`${x.p.color} · size ${x.v.size}`} />
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums">{x.suggest}</div>
                  <div className="text-xs text-muted">to order</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted">
                {x.v.stock} left{x.inc ? ` · ${x.inc} on the way` : ""} · {x.perDay < 0.05 ? "rarely sells" : `sells ${x.perDay.toFixed(1)}/day`} ·{" "}
                <span className={cn(x.daysLeft !== null && x.daysLeft < LEAD_DAYS && "font-semibold text-bad")}>{x.daysLeft === null ? "no recent sales" : x.daysLeft === 0 ? "sold out" : `runs out in ${x.daysLeft} days`}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">{data.suppliers.find((s) => s.id === x.p.supplierId)?.name ?? ""}</div>
            </li>
          ))}
          {!r.reorder.length && <li className="py-6 text-center text-sm text-muted">Nothing to reorder right now.</li>}
        </ul>
        <div className="hidden xl:block">
        <TableWrap>
          <table className="tbl">
            <thead><tr><th>Product</th><th>Size</th><th className="num">Left</th><th className="num">On the way</th><th className="num">Sells per day</th><th className="num">Runs out in</th><th className="num">Suggest ordering</th></tr></thead>
            <tbody>
              {r.reorder.slice(0, 25).map((x) => (
                <tr key={x.v.sku}>
                  <td className="min-w-56"><ProductCell p={x.p} href={`/inventory/${x.p.id}`} sub={`${x.p.color} · ${data.suppliers.find((s) => s.id === x.p.supplierId)?.name ?? ""}`} /></td>
                  <td>{x.v.size}</td>
                  <td className="num">{x.v.stock}</td>
                  <td className="num text-info">{x.inc || "—"}</td>
                  <td className="num">{x.perDay.toFixed(2)}</td>
                  <td className={cn("num", x.daysLeft !== null && x.daysLeft < LEAD_DAYS && "font-semibold text-bad")}>{x.daysLeft === null ? "—" : x.daysLeft === 0 ? "sold out" : `${x.daysLeft} days`}</td>
                  <td className="num font-bold">{x.suggest}</td>
                </tr>
              ))}
              {!r.reorder.length && <tr><td colSpan={7} className="text-center text-muted">Nothing to reorder right now.</td></tr>}
            </tbody>
          </table>
        </TableWrap>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card id="slow" className="scroll-mt-6" title="Slow movers" icon={Snail} subtitle="Nothing sold in 3+ weeks. Maybe try a discount or a better spot." pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Product</th><th className="num hidden sm:table-cell">Left</th><th className="num">Money stuck</th><th className="num">Last sale</th></tr></thead>
              <tbody>
                {r.slow.map((x) => (
                  <tr key={x.p.id}>
                    <td><ProductCell p={x.p} href={`/inventory/${x.p.id}`} sub={`${x.p.color} · ${totalStock(x.p)} left`} /></td>
                    <td className={"num hidden sm:table-cell"}>{totalStock(x.p)}</td>
                    <td className="num">{money(x.value)}</td>
                    <td className="num whitespace-nowrap text-warn">{x.idle} days ago</td>
                  </tr>
                ))}
                {!r.slow.length && <tr><td colSpan={4} className="text-center text-muted">Everything is selling. Nice!</td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card title="What your stock is worth" pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Category</th><th className="num hidden sm:table-cell">Pieces</th><th className="num">You paid</th><th className="num max-[359px]:hidden">If all sold</th></tr></thead>
              <tbody>
                {r.valuation.map(([k, a]) => (
                  <tr key={k}><td>{k}</td><td className="num hidden sm:table-cell">{a.units}</td><td className="num">{money(a.cost)}</td><td className="num max-[359px]:hidden">{money(a.retail)}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td>Total</td>
                  <td className="num hidden sm:table-cell">{fmtNum(r.valuation.reduce((t, [, a]) => t + a.units, 0))}</td>
                  <td className="num">{money(r.valuation.reduce((t, [, a]) => t + a.cost, 0))}</td>
                  <td className="num max-[359px]:hidden">{money(r.valuation.reduce((t, [, a]) => t + a.retail, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
