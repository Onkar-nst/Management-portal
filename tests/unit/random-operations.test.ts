// Stress test: thousands of random actions (many of them invalid on purpose)
// against the sample shop. After every step the data must still be consistent.
import { describe, expect, it } from "vitest";
import * as A from "@/lib/actions";
import { buildSeed } from "@/lib/seed";
import type { AppData, MovementType } from "@/lib/types";
import { testCtx } from "./fixtures";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Mostly sensible numbers, sometimes nasty ones.
const NASTY = [0, -1, -5, 1.5, 0.1, NaN, Infinity, 1e9, -0];

function runRandom(seed: number, steps: number) {
  const r = rng(seed);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const num = (lo: number, hi: number) => (r() < 0.12 ? pick(NASTY) : int(lo, hi));
  const ctx = testCtx();
  let d: AppData = buildSeed();
  const counts = { ok: 0, rejected: 0 };

  for (let step = 0; step < steps; step++) {
    const p = pick(d.products);
    const v = p ? pick(p.variants) : undefined;
    const kind = pick(["sale", "sale", "return", "adjust", "order", "receive", "status", "archive", "product", "edit"]);
    let res: A.ActionResult;
    switch (kind) {
      case "sale": {
        const lines = Array.from({ length: int(1, 3) }, () => {
          const pp = pick(d.products);
          const vv = pick(pp.variants);
          return { productId: pp.id, size: vv.size, qty: num(1, 4), unitPrice: num(100, 2000), discountPct: r() < 0.1 ? 150 : int(0, 30), unitCost: pp.costPrice, returnedQty: 0 };
        });
        res = A.createSale(d, { date: "", customerName: "Fuzz", customerPhone: "", channel: "Store", paymentMethod: "Cash", gstPct: pick([0, 5, 12, 99]), items: lines, notes: "" }, ctx);
        break;
      }
      case "return": {
        const s = pick(d.sales);
        res = A.returnSaleItem(d, s.id, int(0, s.items.length), num(1, 3), "fuzz", ctx);
        break;
      }
      case "adjust":
        res = A.adjustStock(d, p.id, r() < 0.05 ? "NOPE" : v!.size, r() < 0.5 ? -num(1, 30) : num(1, 10), pick<MovementType>(["Adjustment", "Damaged", "Return to Supplier"]), "fuzz", ctx);
        break;
      case "order":
        res = A.createPurchaseOrder(
          d,
          {
            supplierId: r() < 0.05 ? "" : pick(d.suppliers).id,
            status: "Ordered",
            orderDate: ctx.now(),
            expectedDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
            notes: "",
            items: p.variants.slice(0, int(1, p.variants.length)).map((vv) => ({ productId: p.id, size: vv.size, qtyOrdered: num(1, 8), qtyReceived: 0, unitCost: num(50, 500) })),
          },
          ctx,
        );
        break;
      case "receive": {
        const po = pick(d.purchaseOrders);
        res = A.receivePurchaseOrder(d, po.id, po.items.map((i) => (r() < 0.3 ? num(0, i.qtyOrdered - i.qtyReceived + 1) : i.qtyOrdered - i.qtyReceived)), "", "", ctx);
        break;
      }
      case "status":
        res = A.setPOStatus(d, pick(d.purchaseOrders).id, pick(["Ordered", "In Transit", "Cancelled", "Received"]));
        break;
      case "archive":
        res = A.setProductActive(d, p.id, r() < 0.7);
        break;
      case "product":
        res = A.saveProduct(d, { ...p, id: "", name: `Fuzz ${step}`, styleCode: r() < 0.2 ? p.styleCode : `FZ-${step}`, variants: [{ size: "M", sku: "", stock: num(0, 10) }], costPrice: num(10, 500) }, ctx);
        break;
      default:
        res = A.saveProduct(d, { ...p, sellingPrice: num(0, p.mrp), variants: [...p.variants.map((x) => ({ ...x, stock: num(0, 99) })), ...(r() < 0.2 ? [{ size: `Z${step}`, sku: "", stock: 5 }] : [])] }, ctx);
    }

    if (res.ok) {
      counts.ok++;
      const problems = A.findDataProblems(res.data);
      if (problems.length) throw new Error(`Step ${step} (${kind}) broke the data: ${problems.slice(0, 3).join("; ")}`);
      d = res.data;
    } else {
      counts.rejected++;
      expect(res.error.length).toBeGreaterThan(5); // always a readable message
    }
  }
  return { d, counts };
}

describe("random operations never corrupt the data", () => {
  for (const seed of [1, 7, 42, 1234, 99999]) {
    it(`seed ${seed}: 600 random actions`, () => {
      const { d, counts } = runRandom(seed, 600);
      expect(A.findDataProblems(d)).toEqual([]);
      // the mix should exercise both paths
      expect(counts.ok).toBeGreaterThan(100);
      expect(counts.rejected).toBeGreaterThan(30);
      // round-trips through storage
      expect(A.parseAppData(JSON.parse(JSON.stringify(d)))).not.toBeNull();
    });
  }

  it("a rejected action never changes the data", () => {
    const d = buildSeed();
    const before = JSON.stringify(d);
    const p = d.products[0];
    A.createSale(d, { date: "", customerName: "", customerPhone: "", channel: "Store", paymentMethod: "Cash", gstPct: 5, notes: "", items: [{ productId: p.id, size: p.variants[0].size, qty: 10_000, unitPrice: 1, discountPct: 0, unitCost: 1, returnedQty: 0 }] });
    A.adjustStock(d, p.id, p.variants[0].size, -10_000, "Damaged", "");
    A.receivePurchaseOrder(d, d.purchaseOrders[0].id, [999], "", "");
    A.deleteProduct(d, p.id);
    A.deleteSupplier(d, d.suppliers[0].id);
    expect(JSON.stringify(d)).toBe(before);
  });
});
