import type { MovementType, POStatus, Product } from "@/lib/types";
import { isOutOfStock, isLowStock } from "@/lib/utils";
import { CircleCheck, CircleX, ClipboardList, PackageOpen, Truck, type LucideIcon } from "lucide-react";
import { Badge, type Tone } from "./ui";

const poTone: Record<POStatus, Tone> = {
  Ordered: "neutral",
  "In Transit": "info",
  "Partially Received": "warn",
  Received: "ok",
  Cancelled: "bad",
};
const poLabel: Record<POStatus, string> = {
  Ordered: "Ordered",
  "In Transit": "On the way",
  "Partially Received": "Partly arrived",
  Received: "Received",
  Cancelled: "Cancelled",
};
const poIcon: Record<POStatus, LucideIcon> = {
  Ordered: ClipboardList,
  "In Transit": Truck,
  "Partially Received": PackageOpen,
  Received: CircleCheck,
  Cancelled: CircleX,
};
export const POStatusBadge = ({ status }: { status: POStatus }) => (
  <Badge tone={poTone[status]} icon={poIcon[status]}>{poLabel[status]}</Badge>
);

export function StockBadge({ p }: { p: Product }) {
  if (!p.active) return <Badge>Archived</Badge>;
  if (isOutOfStock(p)) return <Badge tone="bad" dot>Sold out</Badge>;
  if (p.variants.some((v) => v.stock === 0)) return <Badge tone="warn" dot>Some sizes sold out</Badge>;
  if (isLowStock(p)) return <Badge tone="warn" dot>Running low</Badge>;
  return <Badge tone="ok" dot>Good stock</Badge>;
}

const mvTone: Record<MovementType, Tone> = {
  "Purchase In": "ok",
  "Sale Out": "brand",
  "Customer Return": "info",
  "Return to Supplier": "warn",
  Adjustment: "neutral",
  Damaged: "bad",
  "Opening Stock": "neutral",
};
const mvLabel: Record<MovementType, string> = {
  "Purchase In": "Stock arrived",
  "Sale Out": "Sold",
  "Customer Return": "Customer return",
  "Return to Supplier": "Sent back to supplier",
  Adjustment: "Count correction",
  Damaged: "Damaged",
  "Opening Stock": "Opening stock",
};
export const movementLabel = (t: MovementType) => mvLabel[t];
export const MovementBadge = ({ type }: { type: MovementType }) => <Badge tone={mvTone[type]}>{mvLabel[type]}</Badge>;
