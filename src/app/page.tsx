"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shirt, ShoppingBag, Sparkles, AlarmClock, ArrowDown, ArrowUp, CircleCheckBig, CircleX, CloudSun, IndianRupee, Moon, Package, Snail, Sun, TrendingUp, TriangleAlert, Truck, Plus, ChevronRight, type LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Card, ProductCell, Stat, TableWrap } from "@/components/ui";
import { DailyChart } from "@/components/DailyChart";
import { POStatusBadge } from "@/components/badges";
import { daysAgo, fmtNum, lineNetQty, lineRevenue, money, poPending, saleProfit, saleSubtotal, saleTotal, saleUnits, totalStock } from "@/lib/utils";
import { dueIn, greeting, plural, timeAgo } from "@/lib/humanize";

const QUICK: { href: string; label: string; sub: string; icon: LucideIcon; primary?: boolean }[] = [
  { href: "/pos", label: "Make a sale", sub: "A customer is buying", icon: ShoppingBag, primary: true },
  { href: "/purchases?new=arrived", label: "Stock arrived", sub: "A delivery came in", icon: Truck },
  { href: "/inventory?new=1", label: "Add a product", sub: "Something new to sell", icon: Plus },
  { href: "/inventory", label: "Check my stock", sub: "See what's left", icon: Shirt },
];

/** One-time note for first visitors, pointing at the Help page. */
function WelcomeNote() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("kapda-welcome") !== "seen");
    } catch {}
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem("kapda-welcome", "seen");
    } catch {}
  };
  return (
    <div className="mb-6 flex animate-fade flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/15 bg-brand-soft/60 p-4" role="note">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={19} aria-hidden /></span>
        <div>
          <div className="font-bold">Welcome! This is a sample shop you can play with.</div>
          <div className="text-sm text-ink/75">Nothing here is real, so try anything. The Help page explains everything in two minutes.</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href="/help"><Button variant="primary">Show me how it works</Button></Link>
        <Button onClick={close}>Got it</Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data } = useStore();
  const pmap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const m = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const last30 = data.sales.filter((s) => daysAgo(s.date) < 30);
    const today = data.sales.filter((s) => new Date(s.date).getTime() >= startToday);
    const month = data.sales.filter((s) => new Date(s.date).getTime() >= startMonth);
    const sum = (arr: typeof data.sales, f: (s: (typeof data.sales)[0]) => number) => arr.reduce((t, s) => t + f(s), 0);

    const active = data.products.filter((p) => p.active);
    const units = active.reduce((t, p) => t + totalStock(p), 0);
    const costValue = active.reduce((t, p) => t + totalStock(p) * p.costPrice, 0);
    const retailValue = active.reduce((t, p) => t + totalStock(p) * p.sellingPrice, 0);

    const lowVariants = active
      .flatMap((p) => p.variants.filter((v) => v.stock <= p.reorderLevel).map((v) => ({ p, v })))
      .sort((a, b) => a.v.stock - b.v.stock);
    const outCount = lowVariants.filter((x) => x.v.stock === 0).length;

    const openPOs = data.purchaseOrders
      .filter((p) => ["Ordered", "In Transit", "Partially Received"].includes(p.status))
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
    const latePOs = openPOs.filter((p) => dueIn(p.expectedDate).late);
    const soonPOs = openPOs.filter((p) => !dueIn(p.expectedDate).late && new Date(p.expectedDate).getTime() - Date.now() < 3 * 86_400_000);

    const lastSold = new Map<string, string>();
    for (const s of data.sales) for (const it of s.items) if ((lastSold.get(it.productId) ?? "") < s.date) lastSold.set(it.productId, s.date);
    const slow = active.filter((p) => totalStock(p) > 0 && daysAgo(lastSold.get(p.id) ?? p.createdAt) >= 21);

    const days: { date: string; revenue: number; units: number }[] = [];
    for (let i = 29; i >= 0; i--) days.push({ date: new Date(startToday - i * 86_400_000).toISOString(), revenue: 0, units: 0 });
    for (const s of last30) {
      const d = new Date(s.date);
      const idx = 29 - Math.round((startToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
      if (days[idx]) {
        days[idx].revenue += saleSubtotal(s);
        days[idx].units += saleUnits(s);
      }
    }

    const prodAgg = new Map<string, { units: number; revenue: number }>();
    for (const s of last30)
      for (const it of s.items) {
        const a = prodAgg.get(it.productId) ?? { units: 0, revenue: 0 };
        a.units += lineNetQty(it);
        a.revenue += lineRevenue(it);
        prodAgg.set(it.productId, a);
      }

    // compare with same number of days last month
    const dayOfMonth = now.getDate();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 23, 59).getTime();
    const prevMonthRev = sum(data.sales.filter((s) => { const t = new Date(s.date).getTime(); return t >= prevStart && t <= prevEnd; }), saleSubtotal);

    return {
      todayRev: sum(today, saleTotal),
      todayCount: today.length,
      todayUnits: sum(today, saleUnits),
      monthRev: sum(month, saleSubtotal),
      monthProfit: sum(month, saleProfit),
      monthCount: month.length,
      prevMonthRev,
      rev30: sum(last30, saleSubtotal),
      units, costValue, retailValue, lowVariants, outCount, openPOs, latePOs, soonPOs, slow,
      pendingUnits: openPOs.reduce((t, p) => t + poPending(p), 0),
      days,
      top: [...prodAgg.entries()].sort((a, b) => b[1].units - a[1].units).slice(0, 5),
    };
  }, [data, pmap]);

  const supplierName = (id: string) => data.suppliers.find((s) => s.id === id)?.name ?? "—";
  const margin = m.monthRev ? Math.round((m.monthProfit / m.monthRev) * 100) : 0;
  const growth = m.prevMonthRev ? Math.round(((m.monthRev - m.prevMonthRev) / m.prevMonthRev) * 100) : null;
  const name = data.settings.ownerName?.trim();

  const todos = [
    m.outCount > 0 && { icon: CircleX, tone: "bg-bad-soft text-bad", text: `${plural(m.outCount, "size")} sold out`, sub: "Customers can't buy these right now", href: "/inventory?filter=out", cta: "See which" },
    m.lowVariants.length - m.outCount > 0 && { icon: TriangleAlert, tone: "bg-warn-soft text-warn", text: `${plural(m.lowVariants.length - m.outCount, "size")} running low`, sub: "Worth reordering soon", href: "/reports#reorder", cta: "What to reorder" },
    m.latePOs.length > 0 && { icon: AlarmClock, tone: "bg-bad-soft text-bad", text: `${plural(m.latePOs.length, "delivery", "deliveries")} running late`, sub: m.latePOs.map((p) => supplierName(p.supplierId)).join(", "), href: "/purchases", cta: "Follow up" },
    m.soonPOs.length > 0 && { icon: Truck, tone: "bg-info-soft text-info", text: `${plural(m.soonPOs.length, "delivery", "deliveries")} arriving in the next few days`, sub: "Make space and check items on arrival", href: "/purchases", cta: "View" },
    m.slow.length > 0 && { icon: Snail, tone: "bg-canvas text-muted", text: `${plural(m.slow.length, "product")} haven't sold in 3+ weeks`, sub: "Consider a discount or a better display spot", href: "/reports#slow", cta: "See list" },
  ].filter(Boolean) as { icon: LucideIcon; tone: string; text: string; sub: string; href: string; cta: string }[];

  const hour = new Date().getHours();
  const DayIcon = hour >= 5 && hour < 12 ? Sun : hour >= 5 && hour < 17 ? CloudSun : Moon;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-0.5 flex items-center gap-2.5 text-[22px] font-bold tracking-tight sm:text-3xl">
            <DayIcon size={26} strokeWidth={1.9} className="text-warn" aria-hidden />
            {greeting()}{name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink/75 sm:text-[15px]">
            {m.todayCount > 0 ? (
              <>You&apos;ve made <b>{plural(m.todayCount, "sale")}</b> today worth <b>{money(m.todayRev)}</b> ({plural(m.todayUnits, "piece")}). </>
            ) : (
              <>No sales yet today. The first one is always the hardest! </>
            )}
            This month you&apos;re at <b>{money(m.monthRev)}</b>
            {growth !== null && (
              <>, <span className={`inline-flex items-center gap-0.5 font-semibold ${growth >= 0 ? "text-ok" : "text-bad"}`}>{growth >= 0 ? <ArrowUp size={14} strokeWidth={2.5} aria-label="up" /> : <ArrowDown size={14} strokeWidth={2.5} aria-label="down" />}{Math.abs(growth)}%</span> vs the same days last month</>
            )}.
          </p>
        </div>
      </div>

      <WelcomeNote />

      <h2 className="mb-2.5 text-sm font-semibold text-muted">What would you like to do?</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className={`group flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${q.primary ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${q.primary ? "bg-white/15" : "bg-brand-soft text-brand"}`}>
              <q.icon size={22} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-bold leading-tight">{q.label}</span>
              <span className={`hidden text-xs sm:block ${q.primary ? "text-white/80" : "text-muted"}`}>{q.sub}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid grid-cols-2 gap-3 self-start">
          <Stat label="Today's sales" value={money(m.todayRev)} hint={`${plural(m.todayCount, "bill")} · incl. GST`} icon={<IndianRupee size={15} />} />
          <Stat label="This month" value={money(m.monthRev)} hint={`${money(m.monthProfit)} profit · ${margin}% margin`} icon={<TrendingUp size={15} />} tone="ok" help="Sales before GST. Profit is sales minus what you paid the supplier for those pieces." />
          <Stat label="Pieces in the shop" value={fmtNum(m.units)} hint={`Worth ${money(m.retailValue)} at selling price`} icon={<Package size={15} />} help={`You paid ${money(m.costValue)} for this stock.`} />
          <Stat label="On the way" value={fmtNum(m.pendingUnits)} hint={`${plural(m.openPOs.length, "order")} from suppliers`} tone="info" icon={<Truck size={15} />} />
        </div>

        <Card title="Needs your attention" pad={false}>
          {todos.length === 0 ? (
            <div className="p-6 text-center">
              <CircleCheckBig size={32} strokeWidth={1.8} className="mx-auto text-ok" aria-hidden />
              <div className="mt-1 font-semibold">All caught up!</div>
              <div className="text-sm text-muted">Nothing urgent right now.</div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {todos.map((t) => (
                <li key={t.text}>
                  <Link href={t.href} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.tone}`} aria-hidden><t.icon size={17} strokeWidth={2} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t.text}</span>
                      <span className="block truncate text-xs text-muted">{t.sub}</span>
                    </span>
                    <span className="flex shrink-0 items-center text-xs font-semibold text-brand">{t.cta}<ChevronRight size={14} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>




      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="How sales have been going" subtitle="Last 30 days, before GST · hover a bar for that day" className="lg:col-span-2" actions={<span className="text-sm font-semibold">{money(m.rev30)}</span>}>
          <DailyChart points={m.days} />
        </Card>
        <Card title="Latest sales" actions={<Link href="/sales" className="text-xs font-semibold text-brand">All sales</Link>} pad={false}>
          <ul className="divide-y divide-line">
            {data.sales.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link href={`/sales/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                  <Avatar name={s.customerName} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.customerName}</div>
                    <div className="text-xs text-muted">{plural(saleUnits(s), "piece")} · {s.paymentMethod} · {timeAgo(s.date)}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{money(saleTotal(s))}</div>
                </Link>
              </li>
            ))}
            {!data.sales.length && <li className="py-8 text-center text-sm text-muted">No sales yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Best sellers this month" subtitle="Last 30 days, by pieces sold" pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Product</th><th className="num">Sold</th><th className="num hidden sm:table-cell">Earned</th><th className="num">Left</th></tr></thead>
              <tbody>
                {m.top.map(([id, a], i) => {
                  const p = pmap.get(id);
                  if (!p) return null;
                  return (
                    <tr key={id}>
                      <td><div className="flex items-center gap-2"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${["bg-warn-soft text-warn", "bg-canvas text-ink/70", "bg-brand-soft text-brand"][i] ?? "text-muted"}`} aria-label={`Rank ${i + 1}`}>{i + 1}</span><ProductCell p={p} href={`/inventory/${id}`} /></div></td>
                      <td className="num font-semibold">{a.units}</td>
                      <td className="num hidden sm:table-cell">{money(a.revenue)}</td>
                      <td className={`num ${totalStock(p) < 10 ? "font-semibold text-warn" : "text-muted"}`}>{totalStock(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card title="Deliveries on the way" actions={<Link href="/purchases" className="text-xs font-semibold text-brand">All orders</Link>} pad={false}>
          {m.openPOs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nothing on order right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {m.openPOs.map((po) => {
                const due = dueIn(po.expectedDate);
                return (
                  <li key={po.id}>
                    <Link href={`/purchases/${po.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                      <Avatar name={supplierName(po.supplierId)} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{supplierName(po.supplierId)}</div>
                        <div className="text-xs text-muted">{po.poNumber} · {plural(poPending(po), "piece")} · <span className={due.late ? "font-semibold text-bad" : ""}>{due.text}</span></div>
                      </div>
                      <POStatusBadge status={po.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
