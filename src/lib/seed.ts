// Generates realistic demo data. Deterministic (seeded RNG) so every reset
// gives the same starting point, with dates relative to "today".
import type {
  AppData,
  Category,
  Customer,
  Gender,
  MovementType,
  Product,
  PurchaseOrder,
  Sale,
  SalesChannel,
  PaymentMethod,
  Season,
  StockMovement,
  Supplier,
} from "./types";
import { SIZE_PRESETS } from "./types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

export function buildSeed(): AppData {
  const r = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const int = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
  const now = Date.now();
  const at = (daysBack: number, hour = 11) => {
    const d = new Date(now - daysBack * DAY);
    d.setHours(hour, int(0, 59), 0, 0);
    // Past events must never land later today than the current time.
    if (daysBack >= 0 && d.getTime() > now) return new Date(now - int(5, 90) * 60_000).toISOString();
    return d.toISOString();
  };

  const suppliers: Supplier[] = [
    { id: "sup_1", name: "Tirupur Knit Exports", contactPerson: "R. Senthil", phone: "+91 98430 12345", email: "orders@tirupurknit.in", city: "Tirupur", gstin: "33AAACT1234F1Z5", paymentTermsDays: 30, notes: "Cotton knitwear, T-shirts. MOQ 50 pcs/style." },
    { id: "sup_2", name: "Surat Silk Mills", contactPerson: "Mehul Shah", phone: "+91 98250 55210", email: "sales@suratsilk.in", city: "Surat", gstin: "24AAKCS5678K1Z2", paymentTermsDays: 45, notes: "Sarees, ethnic sets, festive collection." },
    { id: "sup_3", name: "Ahmedabad Denim Co.", contactPerson: "Kiran Patel", phone: "+91 99090 77881", email: "kiran@adenim.co.in", city: "Ahmedabad", gstin: "24AABCA9012L1Z9", paymentTermsDays: 30, notes: "Jeans and trousers." },
    { id: "sup_4", name: "Jaipur Prints House", contactPerson: "Anita Sharma", phone: "+91 94140 33002", email: "hello@jaipurprints.in", city: "Jaipur", gstin: "08AAFCJ3456M1Z1", paymentTermsDays: 15, notes: "Block-printed kurtas & dresses." },
    { id: "sup_5", name: "Ludhiana Woollens", contactPerson: "Gurpreet Singh", phone: "+91 98140 90011", email: "gs@ludhianawool.in", city: "Ludhiana", gstin: "03AAGCL7890N1Z4", paymentTermsDays: 60, notes: "Sweaters & jackets, winter stock." },
    { id: "sup_6", name: "Mumbai Fashion Hub", contactPerson: "Farhan Qureshi", phone: "+91 98200 44567", email: "farhan@mfhub.in", city: "Mumbai", gstin: "27AAHCM2345P1Z7", paymentTermsDays: 30, notes: "Shirts, western wear, accessories." },
  ];

  type Def = [string, Category, Gender, string, string, string, Season, number, number, string, keyof typeof SIZE_PRESETS, string];
  //            name, category, gender, brand, color, fabric, season, cost, mrp, supplier, sizes, hsn
  const defs: Def[] = [
    ["Classic Crew Neck Tee", "T-Shirts", "Men", "Kapda Basics", "Black", "100% Cotton", "All Season", 180, 599, "sup_1", "Apparel (XS–XXL)", "6109"],
    ["Classic Crew Neck Tee", "T-Shirts", "Men", "Kapda Basics", "White", "100% Cotton", "All Season", 180, 599, "sup_1", "Apparel (XS–XXL)", "6109"],
    ["Oversized Graphic Tee", "T-Shirts", "Unisex", "Street Kapda", "Olive", "Cotton Jersey", "Summer", 240, 899, "sup_1", "Apparel (XS–XXL)", "6109"],
    ["Polo T-Shirt", "T-Shirts", "Men", "Kapda Basics", "Navy", "Pique Cotton", "All Season", 290, 999, "sup_1", "Apparel (XS–XXL)", "6105"],
    ["Linen Casual Shirt", "Shirts", "Men", "Kapda Premium", "Sky Blue", "Linen Blend", "Summer", 520, 1799, "sup_6", "Apparel (XS–XXL)", "6205"],
    ["Formal Oxford Shirt", "Shirts", "Men", "Kapda Premium", "White", "Oxford Cotton", "All Season", 460, 1499, "sup_6", "Apparel (XS–XXL)", "6205"],
    ["Checked Flannel Shirt", "Shirts", "Men", "Kapda Basics", "Red Check", "Brushed Cotton", "Winter", 410, 1299, "sup_6", "Apparel (XS–XXL)", "6205"],
    ["Slim Fit Stretch Jeans", "Jeans", "Men", "Denim Kapda", "Indigo", "Cotton Denim 2% Lycra", "All Season", 620, 1999, "sup_3", "Waist (28–38)", "6203"],
    ["Relaxed Fit Jeans", "Jeans", "Men", "Denim Kapda", "Black", "Cotton Denim", "All Season", 590, 1899, "sup_3", "Waist (28–38)", "6203"],
    ["High-Rise Mom Jeans", "Jeans", "Women", "Denim Kapda", "Light Blue", "Cotton Denim", "All Season", 640, 2199, "sup_3", "Waist (28–38)", "6204"],
    ["Chino Trousers", "Trousers", "Men", "Kapda Premium", "Khaki", "Cotton Twill", "All Season", 540, 1699, "sup_3", "Waist (28–38)", "6203"],
    ["Block Print Straight Kurta", "Kurtas", "Women", "Jaipur Rang", "Indigo", "Cotton Cambric", "Summer", 380, 1299, "sup_4", "Apparel (XS–XXL)", "6204"],
    ["Men's Festive Kurta", "Kurtas", "Men", "Jaipur Rang", "Maroon", "Silk Blend", "Festive", 690, 2299, "sup_4", "Apparel (XS–XXL)", "6205"],
    ["Anarkali Kurta Set", "Ethnic Sets", "Women", "Jaipur Rang", "Mustard", "Rayon", "Festive", 820, 2799, "sup_2", "Apparel (XS–XXL)", "6204"],
    ["Floral Maxi Dress", "Dresses", "Women", "Kapda Femme", "Peach", "Georgette", "Summer", 560, 1899, "sup_4", "Apparel (XS–XXL)", "6204"],
    ["Wrap Midi Dress", "Dresses", "Women", "Kapda Femme", "Emerald", "Crepe", "All Season", 610, 2099, "sup_6", "Apparel (XS–XXL)", "6204"],
    ["Banarasi Silk Saree", "Sarees", "Women", "Surat Weaves", "Red & Gold", "Art Silk", "Festive", 1450, 4999, "sup_2", "Free Size", "5407"],
    ["Cotton Handloom Saree", "Sarees", "Women", "Surat Weaves", "Off White", "Handloom Cotton", "Summer", 780, 2499, "sup_2", "Free Size", "5208"],
    ["Denim Trucker Jacket", "Jackets", "Unisex", "Denim Kapda", "Mid Blue", "Cotton Denim", "Winter", 890, 2999, "sup_3", "Apparel (XS–XXL)", "6201"],
    ["Quilted Puffer Jacket", "Jackets", "Men", "Kapda Outdoor", "Charcoal", "Nylon / Poly Fill", "Winter", 1250, 3999, "sup_5", "Apparel (XS–XXL)", "6201"],
    ["Cable Knit Sweater", "Sweaters", "Women", "Kapda Femme", "Cream", "Acrylic Wool", "Winter", 650, 1999, "sup_5", "Apparel (XS–XXL)", "6110"],
    ["V-Neck Pullover", "Sweaters", "Men", "Kapda Basics", "Grey Melange", "Wool Blend", "Winter", 590, 1799, "sup_5", "Apparel (XS–XXL)", "6110"],
    ["Kids Printed Tee Pack (2)", "Kidswear", "Boys", "Kapda Kids", "Multi", "Cotton", "Summer", 210, 699, "sup_1", "Kids (2–12Y)", "6111"],
    ["Girls Party Frock", "Kidswear", "Girls", "Kapda Kids", "Pink", "Net & Satin", "Festive", 420, 1399, "sup_6", "Kids (2–12Y)", "6111"],
    ["Cotton Printed Dupatta", "Accessories", "Women", "Jaipur Rang", "Multi", "Mulmul Cotton", "All Season", 140, 499, "sup_4", "Free Size", "6214"],
    ["Leather Belt", "Accessories", "Men", "Kapda Premium", "Brown", "Genuine Leather", "All Season", 220, 799, "sup_6", "Free Size", "4203"],
  ];

  // Sizes in the middle of a run sell faster than the extremes.
  const sizeWeight = (sizes: string[], i: number) => {
    if (sizes.length === 1) return 1;
    const mid = (sizes.length - 1) / 2;
    return 1.6 - Math.abs(i - mid) / sizes.length * 2;
  };

  const movements: StockMovement[] = [];
  let mvId = 0;
  const mv = (date: string, productId: string, size: string, type: MovementType, qty: number, reference: string, note = "") =>
    movements.push({ id: `mv_${++mvId}`, date, productId, size, type, qty, reference, note });

  const products: Product[] = defs.map((d, idx) => {
    const [name, category, gender, brand, color, fabric, season, cost, mrp, supplierId, sizeKey, hsn] = d;
    const sizes = SIZE_PRESETS[sizeKey];
    const id = `prd_${idx + 1}`;
    const styleCode = `KP-${category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}-${String(1001 + idx)}`;
    const createdAt = at(120 + int(0, 30));
    const variants = sizes.map((size, i) => {
      const stock = Math.round(int(6, 18) * sizeWeight(sizes, i));
      return { size, sku: `${styleCode}-${size}`, stock };
    });
    variants.forEach((v) => mv(createdAt, id, v.size, "Opening Stock", v.stock, "OPENING", "Initial stock count"));
    return {
      id,
      name,
      styleCode,
      category,
      gender,
      brand,
      color,
      fabric,
      season,
      hsnCode: hsn,
      costPrice: cost,
      mrp,
      sellingPrice: Math.round((mrp * (r() > 0.7 ? 0.9 : 1)) / 10) * 10 - 1,
      reorderLevel: sizes.length === 1 ? 4 : 3,
      supplierId,
      location: `Rack ${String.fromCharCode(65 + (idx % 6))}-${(idx % 4) + 1}`,
      variants,
      createdAt,
      active: true,
    };
  });

  const customers: Customer[] = [
    ["Priya Nair", "+91 98765 43210", "Pune", "Retail"],
    ["Rahul Deshmukh", "+91 99220 11223", "Pune", "Retail"],
    ["Sneha Kulkarni", "+91 97300 44556", "Mumbai", "Retail"],
    ["Amit Verma", "+91 98111 22334", "Nashik", "Retail"],
    ["Style Point Boutique", "+91 98222 66778", "Nagpur", "Wholesale"],
    ["Trendz Garments", "+91 98500 99887", "Kolhapur", "Wholesale"],
    ["Neha Joshi", "+91 90110 33445", "Pune", "Retail"],
    ["Vikram Rao", "+91 99600 55667", "Satara", "Retail"],
  ].map(([name, phone, city, type], i) => ({
    id: `cus_${i + 1}`,
    name,
    phone,
    email: "",
    city,
    type: type as Customer["type"],
    createdAt: at(100 - i * 5),
  }));

  const byId = new Map(products.map((p) => [p.id, p]));

  // Interleave events (purchases + sales) in chronological order so stock never goes negative.
  type Ev = { t: number; kind: "po" | "sale" };
  const events: Ev[] = [];
  for (let d = 90; d >= 0; d--) {
    if (d % 12 === 5) events.push({ t: d, kind: "po" });
    const salesToday = int(1, d < 30 ? 4 : 3);
    for (let k = 0; k < salesToday; k++) events.push({ t: d, kind: "sale" });
  }

  const purchaseOrders: PurchaseOrder[] = [];
  const sales: Sale[] = [];
  let poSeq = 0;
  let invSeq = 0;

  const makePOItems = (supplierId: string) => {
    const prods = products.filter((p) => p.supplierId === supplierId);
    const chosen = prods.sort(() => r() - 0.5).slice(0, Math.min(prods.length, int(2, 3)));
    return chosen.flatMap((p) =>
      p.variants.map((v, i) => ({
        productId: p.id,
        size: v.size,
        qtyOrdered: Math.max(4, Math.round(int(8, 16) * sizeWeight(p.variants.map((x) => x.size), i))),
        qtyReceived: 0,
        unitCost: p.costPrice,
      })),
    );
  };

  for (const ev of events) {
    if (ev.kind === "po") {
      const supplierId = pick(suppliers).id;
      const orderDate = at(ev.t + 7, 10);
      const receivedDate = at(ev.t, 15);
      const items = makePOItems(supplierId).map((i) => ({ ...i, qtyReceived: i.qtyOrdered }));
      const poNumber = `PO-2026-${String(++poSeq).padStart(4, "0")}`;
      purchaseOrders.push({
        id: `po_${poSeq}`,
        poNumber,
        supplierId,
        status: "Received",
        orderDate,
        expectedDate: at(ev.t, 10),
        receivedDate,
        invoiceNumber: `INV/${supplierId.toUpperCase()}/${int(1000, 9999)}`,
        transport: pick(["VRL Logistics", "Gati", "Delhivery", "Self pickup", "Safexpress"]),
        notes: "",
        items,
      });
      for (const it of items) {
        const p = byId.get(it.productId)!;
        p.variants.find((v) => v.size === it.size)!.stock += it.qtyReceived;
        mv(receivedDate, it.productId, it.size, "Purchase In", it.qtyReceived, poNumber);
      }
      continue;
    }

    // Sale
    const channel: SalesChannel = r() < 0.65 ? "Store" : r() < 0.8 ? "Online" : "Wholesale";
    const isWholesale = channel === "Wholesale";
    const customer = isWholesale
      ? pick(customers.filter((c) => c.type === "Wholesale"))
      : r() < 0.5
        ? pick(customers.filter((c) => c.type === "Retail"))
        : undefined;
    const date = at(ev.t, int(10, 20));
    const lineCount = isWholesale ? int(2, 4) : int(1, 3);
    const items: Sale["items"] = [];
    for (let l = 0; l < lineCount; l++) {
      const p = pick(products);
      const weights = p.variants.map((_, i) => sizeWeight(p.variants.map((x) => x.size), i));
      let roll = r() * weights.reduce((a, b) => a + b, 0);
      let vi = 0;
      while (roll > weights[vi] && vi < weights.length - 1) roll -= weights[vi++];
      const v = p.variants[vi];
      const want = isWholesale ? int(4, 10) : int(1, 2);
      const qty = Math.min(want, v.stock);
      if (qty <= 0 || items.some((i) => i.productId === p.id && i.size === v.size)) continue;
      v.stock -= qty;
      items.push({
        productId: p.id,
        size: v.size,
        qty,
        unitPrice: p.sellingPrice,
        discountPct: isWholesale ? 25 : pick([0, 0, 0, 5, 10]),
        unitCost: p.costPrice,
        returnedQty: 0,
      });
    }
    if (!items.length) continue;
    const invoiceNumber = `KP/26-27/${String(++invSeq).padStart(5, "0")}`;
    // occasional customer return
    if (!isWholesale && r() < 0.04 && ev.t > 3) {
      items[0].returnedQty = 1;
    }
    sales.push({
      id: `sal_${invSeq}`,
      invoiceNumber,
      date,
      customerId: customer?.id,
      customerName: customer?.name ?? "Walk-in Customer",
      customerPhone: customer?.phone ?? "",
      channel,
      paymentMethod: (isWholesale ? pick(["Bank Transfer", "Credit"]) : pick(["Cash", "UPI", "UPI", "Card"])) as PaymentMethod,
      gstPct: 5,
      items,
      notes: "",
    });
    for (const it of items) {
      mv(date, it.productId, it.size, "Sale Out", -it.qty, invoiceNumber);
      if (it.returnedQty) {
        const p = byId.get(it.productId)!;
        p.variants.find((v) => v.size === it.size)!.stock += it.returnedQty;
        mv(at(ev.t - 2, 13), it.productId, it.size, "Customer Return", it.returnedQty, invoiceNumber, "Size exchange / return");
      }
    }
  }

  // A couple of damaged-stock adjustments for realism.
  for (const [pIdx, days] of [[3, 40], [14, 18]] as const) {
    const p = products[pIdx];
    const v = p.variants.find((x) => x.stock > 2);
    if (v) {
      v.stock -= 1;
      mv(at(days, 17), p.id, v.size, "Damaged", -1, "ADJ", "Stain found during QC");
    }
  }

  // Force a few low / out-of-stock situations so alerts are visible.
  for (const [pIdx, size] of [[7, "32"], [0, "M"], [16, "Free"]] as const) {
    const p = products[pIdx];
    const v = p.variants.find((x) => x.size === size);
    if (v && v.stock > 0) {
      const take = pIdx === 16 ? v.stock - 1 : v.stock;
      if (take > 0) {
        v.stock -= take;
        mv(at(1, 18), p.id, v.size, "Adjustment", -take, "ADJ", "Stock audit correction");
      }
    }
  }

  // Open (incoming) purchase orders.
  const openPOs: [string, PurchaseOrder["status"], number, number][] = [
    ["sup_3", "In Transit", 4, -2],
    ["sup_5", "Ordered", 2, -9],
    ["sup_2", "Ordered", 1, -14],
    ["sup_1", "Partially Received", 6, 1],
  ];
  for (const [supplierId, status, orderedDaysAgo, expectedOffset] of openPOs) {
    const items = makePOItems(supplierId);
    const poNumber = `PO-2026-${String(++poSeq).padStart(4, "0")}`;
    if (status === "Partially Received") {
      items.forEach((it, i) => {
        if (i % 2 === 0) {
          it.qtyReceived = it.qtyOrdered;
          byId.get(it.productId)!.variants.find((v) => v.size === it.size)!.stock += it.qtyReceived;
          mv(at(1, 12), it.productId, it.size, "Purchase In", it.qtyReceived, poNumber, "Partial delivery");
        }
      });
    }
    purchaseOrders.push({
      id: `po_${poSeq}`,
      poNumber,
      supplierId,
      status,
      orderDate: at(orderedDaysAgo, 10),
      expectedDate: at(expectedOffset, 10),
      receivedDate: status === "Partially Received" ? at(1, 12) : undefined,
      invoiceNumber: status === "Ordered" ? "" : `INV/${supplierId.toUpperCase()}/${int(1000, 9999)}`,
      transport: status === "Ordered" ? "" : pick(["VRL Logistics", "Gati", "Delhivery"]),
      notes: status === "In Transit" ? "LR copy received, 3 cartons" : "",
      items,
    });
  }

  movements.sort((a, b) => b.date.localeCompare(a.date));
  sales.sort((a, b) => b.date.localeCompare(a.date));
  purchaseOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  return {
    products,
    suppliers,
    purchaseOrders,
    sales,
    customers,
    movements,
    settings: {
      companyName: "Kapda Clothing Co.",
      defaultGstPct: 5,
      currency: "INR",
      address: "Shop 12, FC Road, Pune, Maharashtra 411004",
      gstin: "27AAACK1234A1Z9",
    },
  };
}
