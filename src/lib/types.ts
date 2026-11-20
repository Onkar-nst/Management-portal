// Domain model for the clothing inventory portal.
// These shapes map 1:1 to future database tables (products, product_variants,
// suppliers, purchase_orders, purchase_order_items, sales, sale_items,
// stock_movements, customers).

export type Category =
  | "T-Shirts"
  | "Shirts"
  | "Jeans"
  | "Trousers"
  | "Kurtas"
  | "Dresses"
  | "Sarees"
  | "Jackets"
  | "Sweaters"
  | "Ethnic Sets"
  | "Kidswear"
  | "Accessories";

export const CATEGORIES: Category[] = [
  "T-Shirts",
  "Shirts",
  "Jeans",
  "Trousers",
  "Kurtas",
  "Dresses",
  "Sarees",
  "Jackets",
  "Sweaters",
  "Ethnic Sets",
  "Kidswear",
  "Accessories",
];

export type Gender = "Men" | "Women" | "Unisex" | "Boys" | "Girls";
export const GENDERS: Gender[] = ["Men", "Women", "Unisex", "Boys", "Girls"];

export type Season = "All Season" | "Summer" | "Winter" | "Monsoon" | "Festive";
export const SEASONS: Season[] = ["All Season", "Summer", "Winter", "Monsoon", "Festive"];

/** Common size runs used in apparel. */
export const SIZE_PRESETS: Record<string, string[]> = {
  "Apparel (XS–XXL)": ["XS", "S", "M", "L", "XL", "XXL"],
  "Waist (28–38)": ["28", "30", "32", "34", "36", "38"],
  "Kids (2–12Y)": ["2Y", "4Y", "6Y", "8Y", "10Y", "12Y"],
  "Free Size": ["Free"],
};

/** One size of a product. Each variant has its own SKU and stock count. */
export interface Variant {
  size: string;
  sku: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  styleCode: string; // base SKU / style number
  category: Category;
  gender: Gender;
  brand: string;
  color: string;
  fabric: string;
  season: Season;
  hsnCode: string; // tax classification code
  costPrice: number; // per unit purchase price
  mrp: number; // maximum retail price
  sellingPrice: number; // default selling price
  reorderLevel: number; // per-size low stock threshold
  supplierId: string;
  location: string; // rack / bin / warehouse
  variants: Variant[];
  createdAt: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  gstin: string;
  paymentTermsDays: number;
  notes: string;
}

export type POStatus = "Ordered" | "In Transit" | "Partially Received" | "Received" | "Cancelled";

export interface POItem {
  productId: string;
  size: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
}

/** Incoming stock: a purchase order placed with a supplier. */
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: POStatus;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string;
  invoiceNumber?: string;
  transport?: string;
  notes: string;
  items: POItem[];
}

export type SalesChannel = "Store" | "Online" | "Wholesale";
export const CHANNELS: SalesChannel[] = ["Store", "Online", "Wholesale"];

export type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank Transfer" | "Credit";
export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "UPI", "Card", "Bank Transfer", "Credit"];

export interface SaleItem {
  productId: string;
  size: string;
  qty: number;
  unitPrice: number; // price before discount
  discountPct: number;
  unitCost: number; // cost snapshot at time of sale, for profit
  returnedQty: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  channel: SalesChannel;
  paymentMethod: PaymentMethod;
  gstPct: number;
  items: SaleItem[];
  notes: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  type: "Retail" | "Wholesale";
  createdAt: string;
}

export type MovementType =
  | "Purchase In"
  | "Sale Out"
  | "Customer Return"
  | "Return to Supplier"
  | "Adjustment"
  | "Damaged"
  | "Opening Stock";

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  size: string;
  type: MovementType;
  qty: number; // signed: + into stock, − out of stock
  reference: string; // PO number, invoice number, or note
  note: string;
}

export interface AppData {
  products: Product[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  sales: Sale[];
  customers: Customer[];
  movements: StockMovement[];
  settings: Settings;
}

export interface Settings {
  companyName: string;
  ownerName?: string; // used for the dashboard greeting
  defaultGstPct: number;
  currency: string;
  address: string;
  gstin: string;
}
