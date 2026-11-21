"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Shirt,
  Truck,
  Receipt,
  ShoppingBag,
  Users,
  Factory,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Menu,
  X,
  Spool,
  Info,
  CircleHelp,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, isLowStock } from "@/lib/utils";
import { applyTheme, getTheme } from "@/lib/theme";
import { Avatar } from "./ui";

const GROUPS = [
  {
    label: "Every day",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboard },
      { href: "/pos", label: "Make a sale", icon: ShoppingBag },
      { href: "/sales", label: "Past sales", icon: Receipt },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/inventory", label: "My stock", icon: Shirt },
      { href: "/purchases", label: "Deliveries", icon: Truck },
      { href: "/movements", label: "Stock history", icon: ArrowLeftRight },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/suppliers", label: "Suppliers", icon: Factory },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help", icon: CircleHelp },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data } = useStore();
  const lowCount = data.products.filter((p) => p.active && isLowStock(p)).length;
  const openPOs = data.purchaseOrders.filter((p) => ["Ordered", "In Transit", "Partially Received"].includes(p.status)).length;
  const owner = data.settings.ownerName?.trim() || "Shop owner";

  useEffect(() => setOpen(false), [path]);
  useEffect(() => applyTheme(getTheme()), []);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-4 p-3" aria-label="Main">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</div>
          <div className="flex flex-col gap-0.5">
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors lg:py-2 lg:text-sm",
                  isActive(href) ? "bg-brand-soft font-semibold text-brand" : "text-ink/80 hover:bg-canvas",
                )}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span className="flex-1">{label}</span>
                {href === "/inventory" && lowCount > 0 && (
                  <span className="rounded-full bg-warn-soft px-1.5 text-xs font-semibold text-warn" title={`${lowCount} products running low`}>{lowCount}</span>
                )}
                {href === "/purchases" && openPOs > 0 && (
                  <span className="rounded-full bg-info-soft px-1.5 text-xs font-semibold text-info" title={`${openPOs} deliveries not arrived yet`}>{openPOs}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2.5 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm"><Spool size={19} strokeWidth={2} aria-hidden /></div>
      <div className="leading-tight">
        <div className="text-sm font-bold">{data.settings.companyName}</div>
        <div className="text-xs text-muted">Shop manager</div>
      </div>
    </Link>
  );

  const footer = (
    <div className="m-3 space-y-2">
      <div className="rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
        <span className="mb-0.5 flex items-center gap-1.5 font-semibold text-ink"><Info size={13} className="text-brand" aria-hidden /> Demo mode</span>
        Everything you do is saved in this browser only, so feel free to try things out. <Link href="/help" className="font-semibold text-brand hover:underline">New here?</Link>
      </div>
      <Link href="/settings" className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-canvas">
        <Avatar name={owner} size={32} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold">{owner}</div>
          <div className="text-xs text-muted">Owner</div>
        </div>
      </Link>
    </div>
  );

  const TABS = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/pos", label: "Sell", icon: ShoppingBag },
    { href: "/inventory", label: "Stock", icon: Shirt, badge: lowCount, tone: "bg-warn text-white" },
    { href: "/purchases", label: "Deliveries", icon: Truck, badge: openPOs, tone: "bg-info text-white" },
  ];
  const inTabs = TABS.some((t) => isActive(t.href));

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface print:hidden lg:flex">
        {brand}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface/95 pr-2 backdrop-blur print:hidden lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5 px-4 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><Spool size={17} strokeWidth={2} aria-hidden /></div>
          <div className="truncate text-[15px] font-bold">{data.settings.companyName}</div>
        </Link>
        <div className="flex items-center">
          <Link href="/help" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-canvas" aria-label="Help"><CircleHelp size={21} /></Link>
          <Link href="/settings" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-canvas" aria-label="Settings"><Avatar name={owner} size={30} /></Link>
        </div>
      </header>

      {/* Phone / tablet bottom tab bar */}
      <nav aria-label="Quick" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur print:hidden lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ href, label, icon: Icon, badge, tone }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", isActive(href) ? "text-brand" : "text-muted")}
            >
              <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", isActive(href) && "bg-brand-soft")}>
                <Icon size={21} strokeWidth={isActive(href) ? 2.3 : 1.9} aria-hidden />
              </span>
              {label}
              {!!badge && <span className={cn("absolute right-[calc(50%-24px)] top-1.5 min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold leading-[18px]", tone)} aria-label={`${badge} need attention`}>{badge}</span>}
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            aria-label="More pages"
            className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", !inTabs ? "text-brand" : "text-muted")}
          >
            <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", !inTabs && "bg-brand-soft")}><Menu size={21} aria-hidden /></span>
            More
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="ml-auto flex h-full w-[82%] max-w-xs animate-fade flex-col bg-surface" style={{ paddingTop: "env(safe-area-inset-top)" }} onClick={(e) => e.stopPropagation()} aria-label="All pages">
            <div className="flex items-center justify-between pr-2">
              {brand}
              <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-canvas" aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="pb-safe">{footer}</div>
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:py-8 print:p-0">
        <div className="mx-auto max-w-7xl animate-fade" key={path}>{children}</div>
      </main>
    </div>
  );
}
