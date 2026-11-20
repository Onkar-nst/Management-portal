// Business rules for the portal, as plain functions.
//
// Each action takes the current data and returns either the new data or a
// friendly error message. Nothing here touches React, the browser or storage,
// so the same rules can run in tests, in an API route, or next to a database.

import type { AppData, Customer, MovementType, POStatus, Product, PurchaseOrder, Sale, Settings, StockMovement, Supplier } from "./types";
import { uid } from "./utils";

export type ActionResult = { ok: true; data: AppData; id?: string } | { ok: false; error: string };

/** Clock + id generator, injectable so tests are deterministic. */
export interface Ctx {
  now: () => string;
  id: (prefix: string) => string;
}
export const defaultCtx: Ctx = { now: () => new Date().toISOString(), id: uid };

const fail = (error: string): ActionResult => ({ ok: false, error });
const isWhole = (n: unknown) => typeof n === "number" && Number.isInteger(n);
const isMoney = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

function applyStock(products: Product[], productId: string, size: string, delta: number) {
  return products.map((p) =>
    p.id !== productId ? p : { ...p, variants: p.variants.map((v) => (v.size === size ? { ...v, stock: v.stock + delta } : v)) },
  );
}

const OPEN: POStatus[] = ["Ordered", "In Transit", "Partially Received"];
export const isOpenPO = (po: PurchaseOrder) => OPEN.includes(po.status);

/** Next style code for a category, e.g. KP-JEA-1027. */
export function nextStyleCode(d: AppData, category: string) {
  const prefix = category.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const max = d.products.reduce((m, p) => Math.max(m, parseInt(p.styleCode.split("-").pop() || "0", 10) || 0), 1000);
  return `KP-${prefix}-${max + 1}`;
}

// ── Products ─────────────────────────────────────────────

export function saveProduct(d: AppData, input: Product, ctx: Ctx = defaultCtx): ActionResult {
  const p: Product = { ...input, name: input.name.trim(), styleCode: input.styleCode.trim().toUpperCase() };
  if (!p.name) return fail("Please give the product a name.");
  if (!p.styleCode) return fail("Please give the product a style code.");
  if (!p.variants.length) return fail("Add at least one size so we know what to stock.");
  const sizes = p.variants.map((v) => v.size.trim().toUpperCase());
  if (sizes.some((s) => !s)) return fail("Every size needs a name.");
  if (new Set(sizes).size !== sizes.length) return fail("The same size is listed twice.");
  if (![p.costPrice, p.mrp, p.sellingPrice].every(isMoney)) return fail("Prices can't be negative.");
  if (p.mrp > 0 && p.sellingPrice > p.mrp) return fail("The selling price can't be more than the MRP printed on the tag.");
  if (!isWhole(p.reorderLevel) || p.reorderLevel < 0) return fail("The low-stock warning must be a whole number (0 or more).");
  if (p.variants.some((v) => !isWhole(v.stock) || v.stock < 0)) return fail("Stock must be a whole number of pieces (0 or more).");
  const dupe = d.products.find((x) => x.styleCode === p.styleCode && x.id !== p.id);
  if (dupe) return fail(`Style code ${p.styleCode} is already used by "${dupe.name}".`);

  const variants = p.variants.map((v, i) => ({ ...v, size: sizes[i], sku: v.sku || `${p.styleCode}-${sizes[i]}` }));
  const existing = d.products.find((x) => x.id === p.id);
  if (existing) {
    // Editing can rename/price things and add sizes, but stock only changes through
    // sales, deliveries and adjustments so the history stays complete.
    const kept = variants.map((v) => ({ ...v, stock: existing.variants.find((e) => e.size === v.size)?.stock ?? 0 }));
    const removed = existing.variants.filter((e) => !kept.some((v) => v.size === e.size));
    if (removed.some((r) => r.stock > 0)) return fail(`Size ${removed.find((r) => r.stock > 0)!.size} still has stock, so it can't be removed.`);
    return { ok: true, id: p.id, data: { ...d, products: d.products.map((x) => (x.id === p.id ? { ...p, variants: kept } : x)) } };
  }
  const id = p.id || ctx.id("prd");
  const date = ctx.now();
  const created: Product = { ...p, variants, id, createdAt: date };
  const opening: StockMovement[] = variants
    .filter((v) => v.stock > 0)
    .map((v) => ({ id: ctx.id("mv"), date, productId: id, size: v.size, type: "Opening Stock", qty: v.stock, reference: "OPENING", note: "Added with product" }));
  return { ok: true, id, data: { ...d, products: [created, ...d.products], movements: [...opening, ...d.movements] } };
}

export function setProductActive(d: AppData, id: string, active: boolean): ActionResult {
  if (!d.products.some((p) => p.id === id)) return fail("We couldn't find that product.");
  return { ok: true, id, data: { ...d, products: d.products.map((p) => (p.id === id ? { ...p, active } : p)) } };
}

export function deleteProduct(d: AppData, id: string): ActionResult {
  const used = d.sales.some((s) => s.items.some((i) => i.productId === id)) || d.purchaseOrders.some((po) => po.items.some((i) => i.productId === id));
  if (used) return fail("This product has sales or purchase history, so it can't be deleted. Archive it instead to hide it.");
  return { ok: true, data: { ...d, products: d.products.filter((p) => p.id !== id), movements: d.movements.filter((m) => m.productId !== id) } };
}

// ── Suppliers & customers ────────────────────────────────

export function saveSupplier(d: AppData, input: Supplier, ctx: Ctx = defaultCtx): ActionResult {
  const s = { ...input, name: input.name.trim() };
  if (!s.name) return fail("Please enter the supplier's name.");
  if (!isWhole(s.paymentTermsDays) || s.paymentTermsDays < 0) return fail("Payment days must be a whole number (0 or more).");
  if (d.suppliers.some((x) => x.name.toLowerCase() === s.name.toLowerCase() && x.id !== s.id)) return fail(`You already have a supplier called "${s.name}".`);
  if (d.suppliers.some((x) => x.id === s.id)) return { ok: true, id: s.id, data: { ...d, suppliers: d.suppliers.map((x) => (x.id === s.id ? s : x)) } };
  const id = ctx.id("sup");
  return { ok: true, id, data: { ...d, suppliers: [...d.suppliers, { ...s, id }] } };
}

export function deleteSupplier(d: AppData, id: string): ActionResult {
  if (d.products.some((p) => p.supplierId === id) || d.purchaseOrders.some((p) => p.supplierId === id))
    return fail("This supplier still has products or orders linked to it, so it can't be removed.");
  return { ok: true, data: { ...d, suppliers: d.suppliers.filter((s) => s.id !== id) } };
}

export function saveCustomer(d: AppData, input: Customer, ctx: Ctx = defaultCtx): ActionResult {
  const c = { ...input, name: input.name.trim(), phone: input.phone.trim() };
  if (!c.name) return fail("Please enter the customer's name.");
  // Same number with or without +91 / leading 0 counts as the same phone.
  const last10 = (p: string) => p.replace(/\D/g, "").slice(-10);
  if (c.phone && last10(c.phone).length >= 6 && d.customers.some((x) => x.id !== c.id && x.phone && last10(x.phone) === last10(c.phone)))
    return fail("Another customer already has this phone number.");
  if (d.customers.some((x) => x.id === c.id)) return { ok: true, id: c.id, data: { ...d, customers: d.customers.map((x) => (x.id === c.id ? c : x)) } };
  const id = ctx.id("cus");
  return { ok: true, id, data: { ...d, customers: [...d.customers, { ...c, id, createdAt: ctx.now() }] } };
}

// ── Purchase orders (incoming stock) ─────────────────────

export function createPurchaseOrder(d: AppData, po: Omit<PurchaseOrder, "id" | "poNumber">, ctx: Ctx = defaultCtx): ActionResult {
  if (!po.supplierId || !d.suppliers.some((s) => s.id === po.supplierId)) return fail("Please pick a supplier first.");
  const items = po.items.filter((i) => i.qtyOrdered !== 0);
  if (!items.length) return fail("Add at least one product and enter how many you're ordering.");
  for (const it of items) {
    const p = d.products.find((x) => x.id === it.productId);
    if (!p || !p.variants.some((v) => v.size === it.size)) return fail("One of the items isn't in your inventory any more.");
    if (!isWhole(it.qtyOrdered) || it.qtyOrdered < 0) return fail(`${p.name} (${it.size}): quantity must be a whole number.`);
    if (!isMoney(it.unitCost)) return fail(`${p.name}: price can't be negative.`);
  }
  const keys = items.map((i) => `${i.productId}|${i.size}`);
  if (new Set(keys).size !== keys.length) return fail("The same product and size is on the order twice.");
  if (new Date(po.expectedDate) < new Date(po.orderDate.slice(0, 10))) return fail("The expected delivery date can't be before the order date.");
  const max = d.purchaseOrders.reduce((m, p) => Math.max(m, parseInt(p.poNumber.split("-").pop() || "0", 10) || 0), 0);
  const poNumber = `PO-${new Date(ctx.now()).getFullYear()}-${String(max + 1).padStart(4, "0")}`;
  const id = ctx.id("po");
  const clean = items.map((i) => ({ ...i, qtyReceived: 0 }));
  return { ok: true, id, data: { ...d, purchaseOrders: [{ ...po, status: "Ordered", items: clean, id, poNumber }, ...d.purchaseOrders] } };
}

const TRANSITIONS: Partial<Record<POStatus, POStatus[]>> = {
  Ordered: ["In Transit", "Cancelled"],
  "In Transit": ["Cancelled"],
};
export function setPOStatus(d: AppData, id: string, status: POStatus): ActionResult {
  const po = d.purchaseOrders.find((p) => p.id === id);
  if (!po) return fail("We couldn't find that order.");
  if (!(TRANSITIONS[po.status] ?? []).includes(status)) return fail(`An order that is "${po.status}" can't be changed to "${status}".`);
  return { ok: true, id, data: { ...d, purchaseOrders: d.purchaseOrders.map((p) => (p.id === id ? { ...p, status } : p)) } };
}

export function receivePurchaseOrder(d: AppData, id: string, receipts: number[], invoiceNumber: string, note: string, ctx: Ctx = defaultCtx): ActionResult {
  const po = d.purchaseOrders.find((p) => p.id === id);
  if (!po) return fail("We couldn't find that order.");
  if (!isOpenPO(po)) return fail(`This order is already ${po.status.toLowerCase()}.`);
  if (receipts.length !== po.items.length) return fail("The delivery doesn't match the order lines.");
  for (let i = 0; i < po.items.length; i++) {
    const pending = po.items[i].qtyOrdered - po.items[i].qtyReceived;
    const q = receipts[i];
    if (!isWhole(q) || q < 0) return fail(`Line ${i + 1}: enter a whole number of pieces.`);
    if (q > pending) return fail(`Line ${i + 1}: only ${pending} still to come.`);
    if (q > 0 && !d.products.find((p) => p.id === po.items[i].productId)?.variants.some((v) => v.size === po.items[i].size))
      return fail(`Line ${i + 1}: that product or size no longer exists.`);
  }
  if (!receipts.some((q) => q > 0)) return fail("Enter how many pieces arrived for at least one item.");
  let products = d.products;
  const date = ctx.now();
  const moves: StockMovement[] = [];
  const items = po.items.map((it, i) => {
    const q = receipts[i];
    if (q > 0) {
      products = applyStock(products, it.productId, it.size, q);
      moves.push({ id: ctx.id("mv"), date, productId: it.productId, size: it.size, type: "Purchase In", qty: q, reference: po.poNumber, note });
    }
    return { ...it, qtyReceived: it.qtyReceived + q };
  });
  const complete = items.every((i) => i.qtyReceived >= i.qtyOrdered);
  const updated: PurchaseOrder = { ...po, items, status: complete ? "Received" : "Partially Received", receivedDate: date, invoiceNumber: invoiceNumber.trim() || po.invoiceNumber };
  return { ok: true, id, data: { ...d, products, purchaseOrders: d.purchaseOrders.map((p) => (p.id === id ? updated : p)), movements: [...moves, ...d.movements] } };
}

// ── Sales & returns ──────────────────────────────────────

export function nextInvoiceNumber(d: AppData, ctx: Ctx = defaultCtx) {
  const now = new Date(ctx.now());
  // Indian financial year starts in April.
  const fy = now.getMonth() >= 3 ? now.getFullYear() % 100 : (now.getFullYear() - 1) % 100;
  const max = d.sales.reduce((m, x) => Math.max(m, parseInt(x.invoiceNumber.split("/").pop() || "0", 10) || 0), 0);
  return `KP/${fy}-${fy + 1}/${String(max + 1).padStart(5, "0")}`;
}

export function createSale(d: AppData, s: Omit<Sale, "id" | "invoiceNumber">, ctx: Ctx = defaultCtx): ActionResult {
  const items = s.items.filter((i) => i.qty !== 0);
  if (!items.length) return fail("The cart is empty. Add something first.");
  if (!isMoney(s.gstPct) || s.gstPct > 28) return fail("GST must be between 0% and 28%.");
  const need = new Map<string, number>();
  for (const it of items) {
    if (!isWhole(it.qty) || it.qty < 0) return fail("Quantities must be whole numbers of pieces.");
    if (!isMoney(it.unitPrice)) return fail("Prices can't be negative.");
    if (!isMoney(it.discountPct) || it.discountPct > 100) return fail("Discounts must be between 0% and 100%.");
    const key = `${it.productId}|${it.size}`;
    need.set(key, (need.get(key) ?? 0) + it.qty);
  }
  for (const [key, qty] of need) {
    const [pid, size] = key.split("|");
    const p = d.products.find((x) => x.id === pid);
    const v = p?.variants.find((x) => x.size === size);
    if (!p || !v) return fail("One of the items isn't in your inventory any more.");
    if (!p.active) return fail(`${p.name} is archived. Restore it before selling it.`);
    if (v.stock < qty) return fail(`Only ${v.stock} left of ${p.name} (${size}).`);
  }
  const invoiceNumber = nextInvoiceNumber(d, ctx);
  const date = s.date || ctx.now();
  let products = d.products;
  const moves: StockMovement[] = items.map((it) => {
    products = applyStock(products, it.productId, it.size, -it.qty);
    return { id: ctx.id("mv"), date, productId: it.productId, size: it.size, type: "Sale Out", qty: -it.qty, reference: invoiceNumber, note: s.customerName };
  });
  const id = ctx.id("sal");
  const sale: Sale = { ...s, customerName: s.customerName.trim() || "Walk-in Customer", items: items.map((i) => ({ ...i, returnedQty: 0 })), id, invoiceNumber, date };
  return { ok: true, id, data: { ...d, products, sales: [sale, ...d.sales], movements: [...moves, ...d.movements] } };
}

export function returnSaleItem(d: AppData, saleId: string, itemIndex: number, qty: number, reason: string, ctx: Ctx = defaultCtx): ActionResult {
  const sale = d.sales.find((s) => s.id === saleId);
  const it = sale?.items[itemIndex];
  if (!sale || !it) return fail("We couldn't find that item on the bill.");
  const max = it.qty - it.returnedQty;
  if (max <= 0) return fail("Everything on this line has already been returned.");
  if (!isWhole(qty) || qty <= 0 || qty > max) return fail(`You can return between 1 and ${max} pieces here.`);
  if (!d.products.find((p) => p.id === it.productId)?.variants.some((v) => v.size === it.size)) return fail("That product or size no longer exists.");
  const updated = { ...sale, items: sale.items.map((x, i) => (i === itemIndex ? { ...x, returnedQty: x.returnedQty + qty } : x)) };
  return {
    ok: true,
    data: {
      ...d,
      products: applyStock(d.products, it.productId, it.size, qty),
      sales: d.sales.map((s) => (s.id === saleId ? updated : s)),
      movements: [{ id: ctx.id("mv"), date: ctx.now(), productId: it.productId, size: it.size, type: "Customer Return", qty, reference: sale.invoiceNumber, note: reason }, ...d.movements],
    },
  };
}

// ── Stock adjustments ────────────────────────────────────

export function adjustStock(d: AppData, productId: string, size: string, delta: number, type: MovementType, note: string, ctx: Ctx = defaultCtx): ActionResult {
  const v = d.products.find((p) => p.id === productId)?.variants.find((x) => x.size === size);
  if (!v) return fail("We couldn't find that product size.");
  if (!isWhole(delta)) return fail("Enter a whole number of pieces.");
  if (!delta) return fail("Enter a quantity other than zero.");
  if (v.stock + delta < 0) return fail(`That would take stock below zero. Only ${v.stock} on hand.`);
  return {
    ok: true,
    data: {
      ...d,
      products: applyStock(d.products, productId, size, delta),
      movements: [{ id: ctx.id("mv"), date: ctx.now(), productId, size, type, qty: delta, reference: "ADJ", note }, ...d.movements],
    },
  };
}

// ── Settings & data ──────────────────────────────────────

export function updateSettings(d: AppData, s: Settings): ActionResult {
  if (!s.companyName.trim()) return fail("Please enter your shop's name.");
  if (!isMoney(s.defaultGstPct) || s.defaultGstPct > 28) return fail("GST must be between 0% and 28%.");
  return { ok: true, data: { ...d, settings: { ...s, companyName: s.companyName.trim(), ownerName: s.ownerName?.trim() } } };
}

export const emptyShop = (d: AppData): AppData => ({ products: [], suppliers: [], purchaseOrders: [], sales: [], customers: [], movements: [], settings: d.settings });

/**
 * Checks that saved data (from storage or a backup file) has the right shape.
 * Returns null if it can't be used, so the app never crashes on bad data.
 */
export function parseAppData(raw: unknown): AppData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AppData>;
  const arrays = ["products", "suppliers", "purchaseOrders", "sales", "customers", "movements"] as const;
  if (!arrays.every((k) => Array.isArray(r[k]))) return null;
  if (!r.settings || typeof r.settings !== "object" || typeof r.settings.companyName !== "string") return null;
  const ok =
    r.products!.every((p) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.variants) && p.variants.every((v) => typeof v.stock === "number")) &&
    r.sales!.every((s) => s && typeof s.id === "string" && Array.isArray(s.items)) &&
    r.purchaseOrders!.every((po) => po && typeof po.id === "string" && Array.isArray(po.items)) &&
    r.movements!.every((m) => m && typeof m.qty === "number");
  return ok ? (r as AppData) : null;
}

/** Problems that should never happen; used by tests and the Settings health check. */
export function findDataProblems(d: AppData): string[] {
  const problems: string[] = [];
  for (const p of d.products)
    for (const v of p.variants) {
      if (v.stock < 0) problems.push(`${p.name} (${v.size}) has negative stock: ${v.stock}`);
      if (!Number.isInteger(v.stock)) problems.push(`${p.name} (${v.size}) has a fractional stock count: ${v.stock}`);
      const ledger = d.movements.filter((m) => m.productId === p.id && m.size === v.size).reduce((t, m) => t + m.qty, 0);
      if (ledger !== v.stock) problems.push(`${p.name} (${v.size}): stock is ${v.stock} but history adds up to ${ledger}`);
    }
  for (const s of d.sales)
    for (const it of s.items) if (it.returnedQty > it.qty || it.returnedQty < 0) problems.push(`Bill ${s.invoiceNumber}: returned more than sold`);
  for (const po of d.purchaseOrders)
    for (const it of po.items) if (it.qtyReceived > it.qtyOrdered) problems.push(`${po.poNumber}: received more than ordered`);
  const inv = d.sales.map((s) => s.invoiceNumber);
  if (new Set(inv).size !== inv.length) problems.push("Two bills share the same number");
  const pos = d.purchaseOrders.map((p) => p.poNumber);
  if (new Set(pos).size !== pos.length) problems.push("Two orders share the same number");
  return problems;
}
