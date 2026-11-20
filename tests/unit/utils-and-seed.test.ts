import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed";
import { findDataProblems } from "@/lib/actions";
import { dueIn, greeting, initials, plural, timeAgo, colorHex } from "@/lib/humanize";
import { isLowStock, isOutOfStock, lineRevenue, money, poPending, saleCost, saleProfit, saleSubtotal, saleTax, saleTotal, toCSV, totalStock } from "@/lib/utils";
import type { Sale } from "@/lib/types";
import { product } from "./fixtures";

describe("money and bill maths", () => {
  it("formats rupees the Indian way", () => {
    expect(money(1234567)).toBe("₹12,34,567");
    expect(money(0)).toBe("₹0");
    expect(money(NaN)).toBe("₹0");
    expect(money(99.6)).toBe("₹100");
  });

  const sale: Sale = {
    id: "s", invoiceNumber: "X", date: "", customerName: "", customerPhone: "", channel: "Store", paymentMethod: "Cash", gstPct: 5, notes: "",
    items: [
      { productId: "a", size: "M", qty: 2, unitPrice: 1000, discountPct: 10, unitCost: 400, returnedQty: 0 }, // 1800
      { productId: "b", size: "L", qty: 3, unitPrice: 500, discountPct: 0, unitCost: 200, returnedQty: 1 }, // 2 net → 1000
    ],
  };
  it("applies discounts and returns before GST", () => {
    expect(lineRevenue(sale.items[0])).toBe(1800);
    expect(saleSubtotal(sale)).toBe(2800);
    expect(saleTax(sale)).toBe(140);
    expect(saleTotal(sale)).toBe(2940);
    expect(saleCost(sale)).toBe(800 + 400);
    expect(saleProfit(sale)).toBe(1600);
  });

  it("stock helpers", () => {
    const p = product({ reorderLevel: 2, variants: [{ size: "S", sku: "", stock: 0 }, { size: "M", sku: "", stock: 9 }] });
    expect(totalStock(p)).toBe(9);
    expect(isLowStock(p)).toBe(true);
    expect(isOutOfStock(p)).toBe(false);
    expect(poPending({ items: [{ qtyOrdered: 5, qtyReceived: 2 }, { qtyOrdered: 1, qtyReceived: 1 }] } as never)).toBe(3);
  });
});

describe("CSV export", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(toCSV([{ a: 'He said "hi", ok', b: "two\nlines" }])).toBe('a,b\n"He said ""hi"", ok","two\nlines"');
  });
  it("neutralises spreadsheet formulas in text but keeps real numbers", () => {
    const out = toCSV([{ name: "=HYPERLINK(\"evil\")", note: "+cmd", at: "@x", qty: -2, text: "-5" }]).split("\n")[1];
    expect(out.startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(out).toContain("'+cmd");
    expect(out).toContain("'@x");
    expect(out).toContain(",-2,");
    expect(out.endsWith(",-5")).toBe(true);
  });
  it("handles an empty list", () => expect(toCSV([])).toBe(""));
});

describe("friendly wording", () => {
  it("greets by time of day", () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe("Good morning");
    expect(greeting(new Date(2026, 0, 1, 14))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 0, 1, 20))).toBe("Good evening");
    expect(greeting(new Date(2026, 0, 1, 2))).toBe("Working late");
  });
  it("relative times", () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(timeAgo(ago(10_000))).toBe("just now");
    expect(timeAgo(ago(5 * 60_000))).toBe("5 min ago");
    expect(timeAgo(ago(3 * 3_600_000))).toBe("3 hours ago");
    expect(timeAgo(ago(26 * 3_600_000))).toBe("yesterday");
    expect(timeAgo(ago(3 * 86_400_000))).toBe("3 days ago");
    expect(timeAgo(undefined)).toBe("—");
  });
  it("due dates", () => {
    const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
    expect(dueIn(inDays(0)).text).toBe("due today");
    expect(dueIn(inDays(1)).text).toBe("due tomorrow");
    expect(dueIn(inDays(5))).toEqual({ text: "due in 5 days", late: false });
    expect(dueIn(inDays(-2))).toEqual({ text: "2 days late", late: true });
  });
  it("plurals, initials and colours", () => {
    expect(plural(1, "piece")).toBe("1 piece");
    expect(plural(3, "delivery", "deliveries")).toBe("3 deliveries");
    expect(initials("Surat Silk Mills")).toBe("SS");
    expect(initials("   ")).toBe("?");
    expect(colorHex("Navy")).toMatch(/^#/);
    expect(colorHex("Red & Gold")).toContain("gradient");
  });
});

describe("sample data", () => {
  const d = buildSeed();
  it("is internally consistent", () => expect(findDataProblems(d)).toEqual([]));
  it("has realistic content", () => {
    expect(d.products).toHaveLength(26);
    expect(d.suppliers).toHaveLength(6);
    expect(d.sales.length).toBeGreaterThan(150);
    expect(d.purchaseOrders.filter((p) => p.status !== "Received").length).toBe(4);
    expect(d.products.some((p) => isLowStock(p))).toBe(true);
  });
  it("has nothing dated in the future except expected deliveries", () => {
    const now = Date.now() + 1000;
    expect(d.sales.every((s) => new Date(s.date).getTime() <= now)).toBe(true);
    expect(d.movements.every((m) => new Date(m.date).getTime() <= now)).toBe(true);
  });
  it("is the same every time (except dates)", () => {
    const strip = (x: unknown) => JSON.stringify(x).replace(/"\d{4}-\d\d-\d\dT[^"]+"/g, '"D"');
    expect(strip(buildSeed().products)).toBe(strip(buildSeed().products));
  });
});
