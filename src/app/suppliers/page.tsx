"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Phone, Mail, Factory, MapPin } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Supplier } from "@/lib/types";
import { Avatar, Button, Card, Confirm, Empty, Field, Modal, PageHeader } from "@/components/ui";
import { money, poPending, poValue, totalStock } from "@/lib/utils";

const blank: Supplier = { id: "", name: "", contactPerson: "", phone: "", email: "", city: "", gstin: "", paymentTermsDays: 30, notes: "" };

export default function SuppliersPage() {
  const { data, saveSupplier, deleteSupplier, toast } = useStore();
  const [edit, setEdit] = useState<Supplier | null>(null);
  const [removing, setRemoving] = useState<Supplier | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { products: number; units: number; orders: number; purchased: number; pending: number }>();
    for (const s of data.suppliers) m.set(s.id, { products: 0, units: 0, orders: 0, purchased: 0, pending: 0 });
    for (const p of data.products) {
      const a = m.get(p.supplierId);
      if (a && p.active) { a.products++; a.units += totalStock(p); }
    }
    for (const po of data.purchaseOrders) {
      const a = m.get(po.supplierId);
      if (!a || po.status === "Cancelled") continue;
      a.orders++;
      a.purchased += po.items.reduce((t, i) => t + i.qtyReceived * i.unitCost, 0);
      a.pending += poPending(po);
    }
    return m;
  }, [data]);

  const save = () => {
    if (!edit) return;
    const r = saveSupplier(edit);
    if (!r.ok) return toast(r.error, "error");
    toast(edit.id ? "Supplier details updated." : `${edit.name} added to your suppliers.`);
    setEdit(null);
  };

  const remove = (id: string) => {
    const r = deleteSupplier(id);
    if (!r.ok) return toast(r.error, "error");
    toast("Supplier removed.");
  };

  return (
    <>
      <PageHeader title="Suppliers" icon={Factory} subtitle="The mills, makers and wholesalers you buy from" actions={<Button variant="primary" onClick={() => setEdit({ ...blank })}><Plus size={16} /> Add a supplier</Button>} />
      {data.suppliers.length === 0 && <Card><Empty title="No suppliers yet" icon={Factory} action={<Button variant="primary" onClick={() => setEdit({ ...blank })}><Plus size={15} /> Add your first supplier</Button>}>Add who you buy from so you can order stock and track deliveries.</Empty></Card>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.suppliers.map((s) => {
          const a = stats.get(s.id)!;
          return (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size={42} />
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="flex items-center gap-1 text-sm text-muted"><MapPin size={13} aria-hidden /> {s.city} · {s.contactPerson}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="rounded p-1.5 text-muted hover:bg-canvas" onClick={() => setEdit(s)} aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
                  <button className="rounded p-1.5 text-muted hover:bg-bad-soft hover:text-bad" onClick={() => setRemoving(s)} aria-label={`Remove ${s.name}`}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <a href={s.phone ? `tel:${s.phone.replace(/\s/g, "")}` : undefined} className="flex items-center gap-2 text-muted hover:text-brand"><Phone size={13} /> {s.phone || "—"}</a>
                <a href={s.email ? `mailto:${s.email}` : undefined} className="flex items-center gap-2 text-muted hover:text-brand"><Mail size={13} /> {s.email || "—"}</a>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-canvas p-3 text-center text-sm">
                <div><div className="font-semibold">{a.products}</div><div className="text-xs text-muted">Products</div></div>
                <div><div className="font-semibold">{money(a.purchased)}</div><div className="text-xs text-muted">Bought</div></div>
                <div><div className={`font-semibold ${a.pending ? "text-info" : ""}`}>{a.pending}</div><div className="text-xs text-muted">On the way</div></div>
              </div>
              <div className="mt-3 text-xs text-muted">GSTIN {s.gstin || "—"} · You pay within {s.paymentTermsDays} days</div>
              {s.notes && <div className="mt-1 text-xs text-muted">{s.notes}</div>}
            </Card>
          );
        })}
      </div>

      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing.id)}
        title={`Remove ${removing?.name}?`}
        confirmLabel="Remove supplier"
        danger
      >
        Suppliers that still have products or orders linked to them can&apos;t be removed.
      </Confirm>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit supplier" : "Add a supplier"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name *" className="col-span-2"><input className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Contact person"><input className="inp" value={edit.contactPerson} onChange={(e) => setEdit({ ...edit, contactPerson: e.target.value })} /></Field>
            <Field label="City"><input className="inp" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            <Field label="Phone"><input className="inp" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email"><input className="inp" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="GSTIN"><input className="inp" value={edit.gstin} onChange={(e) => setEdit({ ...edit, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="Pay them within (days)"><input type="number" className="inp" value={edit.paymentTermsDays} onChange={(e) => setEdit({ ...edit, paymentTermsDays: +e.target.value })} /></Field>
            <Field label="Notes" className="col-span-2"><textarea className="inp" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
