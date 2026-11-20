import type { Product, Sale, SaleItem, PurchaseOrder } from "./types";

export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const money = (n: number) => inr.format(Math.round(n || 0));

const num = new Intl.NumberFormat("en-IN");
export const fmtNum = (n: number) => num.format(n || 0);

export const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const todayISO = () => new Date().toISOString();
export const dateInput = (iso?: string) => (iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10));

export const totalStock = (p: Product) => p.variants.reduce((s, v) => s + v.stock, 0);

export const isLowStock = (p: Product) =>
  p.variants.some((v) => v.stock <= p.reorderLevel);

export const isOutOfStock = (p: Product) => totalStock(p) === 0;

/** Net units sold on a line (after returns). */
export const lineNetQty = (i: SaleItem) => i.qty - i.returnedQty;

/** Line revenue after discount, before GST, net of returns. */
export const lineRevenue = (i: SaleItem) => lineNetQty(i) * i.unitPrice * (1 - i.discountPct / 100);

export const lineCost = (i: SaleItem) => lineNetQty(i) * i.unitCost;

export const saleSubtotal = (s: Sale) => s.items.reduce((t, i) => t + lineRevenue(i), 0);
export const saleTax = (s: Sale) => (saleSubtotal(s) * s.gstPct) / 100;
export const saleTotal = (s: Sale) => saleSubtotal(s) + saleTax(s);
export const saleCost = (s: Sale) => s.items.reduce((t, i) => t + lineCost(i), 0);
export const saleProfit = (s: Sale) => saleSubtotal(s) - saleCost(s);
export const saleUnits = (s: Sale) => s.items.reduce((t, i) => t + lineNetQty(i), 0);

export const poValue = (po: PurchaseOrder) => po.items.reduce((t, i) => t + i.qtyOrdered * i.unitCost, 0);
export const poUnits = (po: PurchaseOrder) => po.items.reduce((t, i) => t + i.qtyOrdered, 0);
export const poPending = (po: PurchaseOrder) =>
  po.items.reduce((t, i) => t + Math.max(0, i.qtyOrdered - i.qtyReceived), 0);

export const daysAgo = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export function toCSV(rows: Record<string, string | number>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    let s = String(v ?? "");
    // Stop spreadsheet apps from running text as a formula (CSV injection),
    // but leave real numbers like -2 alone.
    if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
