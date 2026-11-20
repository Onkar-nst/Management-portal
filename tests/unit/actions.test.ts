import { describe, expect, it } from "vitest";
import * as A from "@/lib/actions";
import type { AppData } from "@/lib/types";
import { emptyData, product, saleInput, testCtx } from "./fixtures";

/** Unwraps a successful result, failing the test with the message otherwise. */
function ok(r: A.ActionResult) {
  if (!r.ok) throw new Error(`Expected success, got: ${r.error}`);
  return r;
}
function err(r: A.ActionResult) {
  if (r.ok) throw new Error("Expected an error, but the action succeeded");
  return r.error;
}
/** Shop with one product (S:5, M:10). */
function shop() {
  const ctx = testCtx();
  const r = ok(A.saveProduct(emptyData(), product(), ctx));
  return { d: r.data, pid: r.id!, ctx };
}
const stock = (d: AppData, pid: string, size: string) => d.products.find((p) => p.id === pid)!.variants.find((v) => v.size === size)!.stock;

describe("saveProduct", () => {
  it("adds a product, builds SKUs and records opening stock", () => {
    const { d, pid } = shop();
    const p = d.products.find((x) => x.id === pid)!;
    expect(p.variants.map((v) => v.sku)).toEqual(["KP-TST-1-S", "KP-TST-1-M"]);
    expect(d.movements.filter((m) => m.productId === pid && m.type === "Opening Stock").map((m) => m.qty)).toEqual([5, 10]);
    expect(A.findDataProblems(d)).toEqual([]);
  });

  it("trims and upper-cases names and codes", () => {
    const r = ok(A.saveProduct(emptyData(), product({ name: "  Tee  ", styleCode: " kp-x-1 ", variants: [{ size: " xl ", sku: "", stock: 1 }] }), testCtx()));
    const p = r.data.products[0];
    expect([p.name, p.styleCode, p.variants[0].size, p.variants[0].sku]).toEqual(["Tee", "KP-X-1", "XL", "KP-X-1-XL"]);
  });

  it.each([
    ["no name", { name: "   " }, "name"],
    ["no style code", { styleCode: "" }, "style code"],
    ["no sizes", { variants: [] }, "at least one size"],
    ["duplicate sizes", { variants: [{ size: "M", sku: "", stock: 1 }, { size: "m", sku: "", stock: 1 }] }, "twice"],
    ["blank size", { variants: [{ size: " ", sku: "", stock: 1 }] }, "size needs a name"],
    ["negative price", { costPrice: -5 }, "negative"],
    ["NaN price", { sellingPrice: NaN }, "negative"],
    ["price above MRP", { sellingPrice: 700 }, "MRP"],
    ["fractional stock", { variants: [{ size: "M", sku: "", stock: 2.5 }] }, "whole number"],
    ["negative stock", { variants: [{ size: "M", sku: "", stock: -1 }] }, "whole number"],
    ["fractional reorder level", { reorderLevel: 1.5 }, "whole number"],
  ])("rejects %s", (_label, over, msg) => {
    expect(err(A.saveProduct(emptyData(), product(over as never), testCtx())).toLowerCase()).toContain(msg.toLowerCase());
  });

  it("rejects a style code already used by another product", () => {
    const { d, ctx } = shop();
    expect(err(A.saveProduct(d, product({ name: "Other" }), ctx))).toContain("already used");
  });

  it("editing never changes stock, even if the form sends different numbers", () => {
    const { d, pid, ctx } = shop();
    const p = d.products.find((x) => x.id === pid)!;
    const r = ok(A.saveProduct(d, { ...p, sellingPrice: 450, variants: p.variants.map((v) => ({ ...v, stock: 999 })) }, ctx));
    expect(stock(r.data, pid, "M")).toBe(10);
    expect(r.data.products[0].sellingPrice).toBe(450);
    expect(A.findDataProblems(r.data)).toEqual([]);
  });

  it("editing can add a size (starting at 0) but can't drop a size that still has stock", () => {
    const { d, pid, ctx } = shop();
    const p = d.products.find((x) => x.id === pid)!;
    const added = ok(A.saveProduct(d, { ...p, variants: [...p.variants, { size: "XL", sku: "", stock: 7 }] }, ctx));
    expect(stock(added.data, pid, "XL")).toBe(0);
    expect(err(A.saveProduct(d, { ...p, variants: [p.variants[0]] }, ctx))).toContain("still has stock");
  });
});

describe("archive and delete", () => {
  it("archives and restores", () => {
    const { d, pid } = shop();
    const archived = ok(A.setProductActive(d, pid, false)).data;
    expect(archived.products[0].active).toBe(false);
    expect(ok(A.setProductActive(archived, pid, true)).data.products[0].active).toBe(true);
  });
  it("deletes a product with no sales or orders, together with its history", () => {
    const { d, pid } = shop();
    const r = ok(A.deleteProduct(d, pid)).data;
    expect(r.products).toHaveLength(0);
    expect(r.movements).toHaveLength(0);
  });
  it("won't delete a product that has been sold", () => {
    const { d, pid, ctx } = shop();
    const sold = ok(A.createSale(d, saleInput([{ productId: pid }]), ctx)).data;
    expect(err(A.deleteProduct(sold, pid))).toContain("Archive it instead");
  });
});

describe("createSale", () => {
  it("reduces stock, records history and numbers the bill", () => {
    const { d, pid, ctx } = shop();
    const r = ok(A.createSale(d, saleInput([{ productId: pid, size: "M", qty: 3 }, { productId: pid, size: "S", qty: 1 }]), ctx));
    expect(stock(r.data, pid, "M")).toBe(7);
    expect(stock(r.data, pid, "S")).toBe(4);
    expect(r.data.sales[0].invoiceNumber).toBe("KP/26-27/00001");
    expect(r.data.sales[0].customerName).toBe("Walk-in Customer");
    expect(A.findDataProblems(r.data)).toEqual([]);
    const second = ok(A.createSale(r.data, saleInput([{ productId: pid }]), ctx));
    expect(second.data.sales[0].invoiceNumber).toBe("KP/26-27/00002");
  });

  it("uses the Indian financial year (April to March) in bill numbers", () => {
    const { d, pid } = shop();
    expect(ok(A.createSale(d, saleInput([{ productId: pid }]), testCtx("2027-02-10T10:00:00Z"))).data.sales[0].invoiceNumber).toMatch(/^KP\/26-27\//);
    expect(ok(A.createSale(d, saleInput([{ productId: pid }]), testCtx("2027-04-02T10:00:00Z"))).data.sales[0].invoiceNumber).toMatch(/^KP\/27-28\//);
  });

  it("won't sell more than is in stock, even when split across two lines", () => {
    const { d, pid, ctx } = shop();
    expect(err(A.createSale(d, saleInput([{ productId: pid, size: "S", qty: 6 }]), ctx))).toContain("Only 5 left");
    expect(err(A.createSale(d, saleInput([{ productId: pid, size: "S", qty: 3 }, { productId: pid, size: "S", qty: 3 }]), ctx))).toContain("Only 5 left");
  });

  it.each([
    ["an empty cart", [], "cart is empty"],
    ["a fractional quantity", [{ qty: 1.5 }], "whole numbers"],
    ["a negative quantity", [{ qty: -2 }], "whole numbers"],
    ["a negative price", [{ unitPrice: -1 }], "negative"],
    ["a discount over 100%", [{ discountPct: 120 }], "between 0% and 100%"],
    ["an unknown size", [{ size: "XXL" }], "isn't in your inventory"],
  ])("rejects %s", (_l, items, msg) => {
    const { d, pid, ctx } = shop();
    expect(err(A.createSale(d, saleInput((items as object[]).map((i) => ({ productId: pid, ...i }))), ctx))).toContain(msg);
  });

  it("rejects silly GST rates", () => {
    const { d, pid, ctx } = shop();
    expect(err(A.createSale(d, saleInput([{ productId: pid }], { gstPct: 50 }), ctx))).toContain("GST");
  });

  it("won't sell an archived product", () => {
    const { d, pid, ctx } = shop();
    const archived = ok(A.setProductActive(d, pid, false)).data;
    expect(err(A.createSale(archived, saleInput([{ productId: pid }]), ctx))).toContain("archived");
  });

  it("a failed sale changes nothing", () => {
    const { d, pid, ctx } = shop();
    const before = JSON.stringify(d);
    A.createSale(d, saleInput([{ productId: pid, size: "S", qty: 99 }]), ctx);
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe("returnSaleItem", () => {
  it("puts pieces back and records it, up to what was bought", () => {
    const { d, pid, ctx } = shop();
    const sold = ok(A.createSale(d, saleInput([{ productId: pid, size: "M", qty: 3 }]), ctx));
    const saleId = sold.id!;
    const r1 = ok(A.returnSaleItem(sold.data, saleId, 0, 2, "Too small", ctx)).data;
    expect(stock(r1, pid, "M")).toBe(9);
    expect(r1.sales[0].items[0].returnedQty).toBe(2);
    expect(err(A.returnSaleItem(r1, saleId, 0, 2, "", ctx))).toContain("between 1 and 1");
    const r2 = ok(A.returnSaleItem(r1, saleId, 0, 1, "", ctx)).data;
    expect(err(A.returnSaleItem(r2, saleId, 0, 1, "", ctx))).toContain("already been returned");
    expect(A.findDataProblems(r2)).toEqual([]);
  });
  it.each([0, -1, 0.5])("rejects a return of %s pieces", (q) => {
    const { d, pid, ctx } = shop();
    const sold = ok(A.createSale(d, saleInput([{ productId: pid, qty: 2 }]), ctx));
    expect(A.returnSaleItem(sold.data, sold.id!, 0, q, "", ctx).ok).toBe(false);
  });
  it("rejects an unknown bill or line", () => {
    const { d, ctx } = shop();
    expect(err(A.returnSaleItem(d, "nope", 0, 1, "", ctx))).toContain("couldn't find");
  });
});

describe("adjustStock", () => {
  it("adds and removes stock with a reason", () => {
    const { d, pid, ctx } = shop();
    const up = ok(A.adjustStock(d, pid, "M", 3, "Adjustment", "Recount", ctx)).data;
    const down = ok(A.adjustStock(up, pid, "M", -2, "Damaged", "Torn", ctx)).data;
    expect(stock(down, pid, "M")).toBe(11);
    expect(down.movements[0]).toMatchObject({ type: "Damaged", qty: -2, note: "Torn" });
    expect(A.findDataProblems(down)).toEqual([]);
  });
  it.each([
    [0, "other than zero"],
    [-11, "below zero"],
    [1.5, "whole number"],
    [NaN, "whole number"],
  ])("rejects a change of %s", (delta, msg) => {
    const { d, pid, ctx } = shop();
    expect(err(A.adjustStock(d, pid, "M", delta, "Adjustment", "", ctx))).toContain(msg);
  });
  it("can take stock exactly to zero", () => {
    const { d, pid, ctx } = shop();
    expect(stock(ok(A.adjustStock(d, pid, "S", -5, "Damaged", "", ctx)).data, pid, "S")).toBe(0);
  });
});

describe("purchase orders", () => {
  const order = (pid: string, lines: [string, number][], over = {}) => ({
    supplierId: "sup_1",
    status: "Ordered" as const,
    orderDate: "2026-11-19T00:00:00.000Z",
    expectedDate: "2026-11-25T00:00:00.000Z",
    notes: "",
    items: lines.map(([size, q]) => ({ productId: pid, size, qtyOrdered: q, qtyReceived: 0, unitCost: 200 })),
    ...over,
  });

  it("only adds stock when goods arrive, supports partial deliveries", () => {
    const { d, pid, ctx } = shop();
    const created = ok(A.createPurchaseOrder(d, order(pid, [["S", 4], ["M", 6]]), ctx));
    expect(created.data.purchaseOrders[0].poNumber).toBe("PO-2026-0001");
    expect(stock(created.data, pid, "S")).toBe(5);
    const partial = ok(A.receivePurchaseOrder(created.data, created.id!, [4, 2], "INV-1", "", ctx)).data;
    expect(partial.purchaseOrders[0].status).toBe("Partially Received");
    expect([stock(partial, pid, "S"), stock(partial, pid, "M")]).toEqual([9, 12]);
    expect(err(A.receivePurchaseOrder(partial, created.id!, [0, 5], "", "", ctx))).toContain("only 4 still to come");
    const done = ok(A.receivePurchaseOrder(partial, created.id!, [0, 4], "", "", ctx)).data;
    expect(done.purchaseOrders[0].status).toBe("Received");
    expect(done.purchaseOrders[0].invoiceNumber).toBe("INV-1");
    expect(err(A.receivePurchaseOrder(done, created.id!, [0, 1], "", "", ctx))).toContain("already received");
    expect(A.findDataProblems(done)).toEqual([]);
  });

  it.each([
    ["no supplier", { supplierId: "" }, [["S", 1]], "supplier"],
    ["an unknown supplier", { supplierId: "sup_x" }, [["S", 1]], "supplier"],
    ["no items", {}, [], "Add at least one"],
    ["a fractional quantity", {}, [["S", 1.5]], "whole number"],
    ["the same size twice", {}, [["S", 1], ["S", 2]], "twice"],
    ["an unknown size", {}, [["XXL", 1]], "isn't in your inventory"],
    ["delivery before order date", { expectedDate: "2026-11-01T00:00:00.000Z" }, [["S", 1]], "before the order date"],
  ])("rejects an order with %s", (_l, over, lines, msg) => {
    const { d, pid, ctx } = shop();
    expect(err(A.createPurchaseOrder(d, order(pid, lines as [string, number][], over), ctx))).toContain(msg);
  });

  it("rejects bad delivery counts", () => {
    const { d, pid, ctx } = shop();
    const po = ok(A.createPurchaseOrder(d, order(pid, [["S", 4]]), ctx));
    expect(err(A.receivePurchaseOrder(po.data, po.id!, [0], "", "", ctx))).toContain("at least one");
    expect(err(A.receivePurchaseOrder(po.data, po.id!, [1.5], "", "", ctx))).toContain("whole number");
    expect(err(A.receivePurchaseOrder(po.data, po.id!, [-1], "", "", ctx))).toContain("whole number");
    expect(err(A.receivePurchaseOrder(po.data, po.id!, [1, 1], "", "", ctx))).toContain("doesn't match");
  });

  it("follows sensible status changes only", () => {
    const { d, pid, ctx } = shop();
    const po = ok(A.createPurchaseOrder(d, order(pid, [["S", 4], ["M", 1]]), ctx));
    const moving = ok(A.setPOStatus(po.data, po.id!, "In Transit")).data;
    expect(err(A.setPOStatus(moving, po.id!, "Ordered"))).toContain("can't be changed");
    const partial = ok(A.receivePurchaseOrder(moving, po.id!, [1, 0], "", "", ctx)).data;
    expect(err(A.setPOStatus(partial, po.id!, "Cancelled"))).toContain("can't be changed");
    const cancelled = ok(A.setPOStatus(moving, po.id!, "Cancelled")).data;
    expect(err(A.receivePurchaseOrder(cancelled, po.id!, [1, 0], "", "", ctx))).toContain("cancelled");
  });
});

describe("suppliers and customers", () => {
  it("adds, edits and protects suppliers", () => {
    const { d, ctx } = shop();
    const added = ok(A.saveSupplier(d, { ...d.suppliers[0], id: "", name: "Surat Silk" }, ctx));
    expect(added.data.suppliers).toHaveLength(2);
    expect(err(A.saveSupplier(added.data, { ...d.suppliers[0], id: "", name: "surat silk" }, ctx))).toContain("already have");
    expect(err(A.saveSupplier(d, { ...d.suppliers[0], id: "", name: "  " }, ctx))).toContain("name");
    expect(err(A.saveSupplier(d, { ...d.suppliers[0], id: "", name: "X", paymentTermsDays: -3 }, ctx))).toContain("whole number");
    expect(err(A.deleteSupplier(d, "sup_1"))).toContain("still has products");
    expect(ok(A.deleteSupplier(added.data, added.id!)).data.suppliers).toHaveLength(1);
  });
  it("adds customers and blocks duplicate phone numbers", () => {
    const d = emptyData();
    const c = { id: "", name: "Priya", phone: "+91 98765 43210", email: "", city: "", type: "Retail" as const, createdAt: "" };
    const r = ok(A.saveCustomer(d, c, testCtx()));
    expect(err(A.saveCustomer(r.data, { ...c, name: "Other", phone: "9198765 43210" }, testCtx()))).toContain("phone");
    expect(err(A.saveCustomer(r.data, { ...c, name: "Other", phone: "098765-43210" }, testCtx()))).toContain("phone");
    expect(err(A.saveCustomer(r.data, { ...c, name: "Other", phone: "9876543210" }, testCtx()))).toContain("phone");
    expect(A.saveCustomer(r.data, { ...c, name: "Other", phone: "9876543211" }, testCtx()).ok).toBe(true);
    expect(err(A.saveCustomer(d, { ...c, name: "" }, testCtx()))).toContain("name");
  });
});

describe("settings and saved data", () => {
  it("validates settings", () => {
    const d = emptyData();
    expect(err(A.updateSettings(d, { ...d.settings, companyName: " " }))).toContain("shop's name");
    expect(err(A.updateSettings(d, { ...d.settings, defaultGstPct: 40 }))).toContain("GST");
    expect(ok(A.updateSettings(d, { ...d.settings, companyName: "  New  " })).data.settings.companyName).toBe("New");
  });
  it("accepts good data and rejects broken data", () => {
    const { d } = shop();
    expect(A.parseAppData(JSON.parse(JSON.stringify(d)))).not.toBeNull();
    for (const bad of [null, 42, "x", {}, { ...d, products: "nope" }, { ...d, settings: null }, { ...d, products: [{ id: 1 }] }, { ...d, sales: [{ id: "s", items: null }] }])
      expect(A.parseAppData(bad)).toBeNull();
  });
  it("findDataProblems spots a stock count that doesn't match its history", () => {
    const { d } = shop();
    const broken = { ...d, products: d.products.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, stock: v.stock + 1 })) })) };
    expect(A.findDataProblems(broken).length).toBeGreaterThan(0);
  });
  it("nextStyleCode continues the numbering", () => {
    const { d } = shop();
    expect(A.nextStyleCode(d, "Jeans")).toBe("KP-JEA-1001");
    expect(A.nextStyleCode(emptyData(), "T-Shirts")).toBe("KP-TSH-1001");
  });
});
