import type { AppData, Product, Sale } from "@/lib/types";
import type { Ctx } from "@/lib/actions";

/** Deterministic clock + ids so results are repeatable. */
export function testCtx(start = "2026-11-19T10:00:00.000Z"): Ctx {
  let n = 0;
  let t = new Date(start).getTime();
  return {
    now: () => new Date((t += 1000)).toISOString(),
    id: (prefix) => `${prefix}_t${++n}`,
  };
}

export function product(over: Partial<Product> = {}): Product {
  return {
    id: "",
    name: "Test Tee",
    styleCode: "KP-TST-1",
    category: "T-Shirts",
    gender: "Men",
    brand: "Kapda",
    color: "Black",
    fabric: "Cotton",
    season: "All Season",
    hsnCode: "6109",
    costPrice: 200,
    mrp: 600,
    sellingPrice: 500,
    reorderLevel: 2,
    supplierId: "sup_1",
    location: "",
    variants: [
      { size: "S", sku: "", stock: 5 },
      { size: "M", sku: "", stock: 10 },
    ],
    createdAt: "",
    active: true,
    ...over,
  };
}

export function emptyData(): AppData {
  return {
    products: [],
    suppliers: [{ id: "sup_1", name: "Tirupur Knit", contactPerson: "", phone: "", email: "", city: "Tirupur", gstin: "", paymentTermsDays: 30, notes: "" }],
    purchaseOrders: [],
    sales: [],
    customers: [],
    movements: [],
    settings: { companyName: "Test Shop", defaultGstPct: 5, currency: "INR", address: "", gstin: "" },
  };
}

export function saleInput(items: Partial<Sale["items"][number]>[], over: Partial<Sale> = {}): Omit<Sale, "id" | "invoiceNumber"> {
  return {
    date: "",
    customerName: "",
    customerPhone: "",
    channel: "Store",
    paymentMethod: "Cash",
    gstPct: 5,
    notes: "",
    items: items.map((i) => ({ productId: "", size: "M", qty: 1, unitPrice: 500, discountPct: 0, unitCost: 200, returnedQty: 0, ...i })),
    ...over,
  };
}
