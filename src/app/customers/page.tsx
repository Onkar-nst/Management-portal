"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Phone, Plus, Users, MousePointerClick } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, SearchInput, TableWrap, useMediaQuery } from "@/components/ui";
import { timeAgo } from "@/lib/humanize";
import { fmtDate, money, saleTotal, saleUnits } from "@/lib/utils";

const blank: Customer = { id: "", name: "", phone: "", email: "", city: "", type: "Retail", createdAt: "" };

export default function CustomersPage() {
  const { data, saveCustomer, toast } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const wide = useMediaQuery("(min-width: 1280px)");

  const stats = useMemo(() => {
    const m = new Map<string, { bills: number; spend: number; units: number; last: string; credit: number }>();
    for (const s of data.sales) {
      if (!s.customerId) continue;
      const a = m.get(s.customerId) ?? { bills: 0, spend: 0, units: 0, last: "", credit: 0 };
      a.bills++;
      a.spend += saleTotal(s);
      a.units += saleUnits(s);
      if (s.paymentMethod === "Credit") a.credit += saleTotal(s);
      if (s.date > a.last) a.last = s.date;
      m.set(s.customerId, a);
    }
    return m;
  }, [data.sales]);

  const rows = data.customers
    .filter((c) => !q || `${c.name} ${c.phone} ${c.city}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (stats.get(b.id)?.spend ?? 0) - (stats.get(a.id)?.spend ?? 0));

  const walkIn = data.sales.filter((s) => !s.customerId);
  const sel = data.customers.find((c) => c.id === selected);

  const save = () => {
    if (!edit) return;
    const r = saveCustomer(edit);
    if (!r.ok) return toast(r.error, "error");
    toast(edit.id ? "Customer details updated." : `${edit.name} added to your customers.`);
    setEdit(null);
  };

  const history = sel && (
          <>
              <div className="grid grid-cols-2 gap-3 border-b border-line p-4 text-sm">
                <div><div className="text-xs text-muted">Spent so far</div><div className="font-semibold">{money(stats.get(sel.id)?.spend ?? 0)}</div></div>
                <div><div className="text-xs text-muted">Pieces bought</div><div className="font-semibold">{stats.get(sel.id)?.units ?? 0}</div></div>
                {(stats.get(sel.id)?.credit ?? 0) > 0 && (
                  <div className="col-span-2"><div className="text-xs text-muted">Bought on credit (to collect)</div><div className="font-semibold text-warn">{money(stats.get(sel.id)!.credit)}</div></div>
                )}
              </div>
              <ul className="divide-y divide-line xl:max-h-96 xl:overflow-y-auto">
                {data.sales.filter((s) => s.customerId === sel.id).map((s) => (
                  <li key={s.id} className="flex justify-between px-4 py-2.5 text-sm">
                    <div><Link href={`/sales/${s.id}`} className="font-medium hover:text-brand">{s.invoiceNumber}</Link><div className="text-xs text-muted">{fmtDate(s.date)} · {s.paymentMethod}</div></div>
                    <div className="tabular-nums">{money(saleTotal(s))}</div>
                  </li>
                ))}
              </ul>
            </>
  );

  return (
    <>
      <PageHeader
        title="Customers"
        icon={Users}
        subtitle={`${data.customers.length} regulars saved, plus ${walkIn.length} walk-in bills`}
        actions={<Button variant="primary" onClick={() => setEdit({ ...blank })}><Plus size={16} /> Add a customer</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card pad={false}>
          <div className="border-b border-line p-3"><SearchInput value={q} onChange={setQ} placeholder="Name, phone, city…" /></div>
          <ul className="mlist sm:grid-cols-2 xl:hidden" aria-label="Customers">
            {rows.map((c) => {
              const st = stats.get(c.id);
              return (
                <li key={c.id} className="mcard">
                  <button className="flex w-full items-center gap-3 text-left" onClick={() => setSelected(c.id)} aria-label={`See ${c.name}'s purchases`}>
                    <Avatar name={c.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted">{c.type === "Wholesale" && <Badge tone="info">Wholesale</Badge>}<span className="truncate">{st?.bills ?? 0} visits · last {st?.last ? timeAgo(st.last) : "never"}</span></div>
                    </div>
                    <div className="shrink-0 text-right font-bold tabular-nums">{money(st?.spend ?? 0)}</div>
                  </button>
                  <div className="mt-2.5 flex gap-2">
                    {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium"><Phone size={15} aria-hidden /> Call</a>}
                    <button onClick={() => setEdit(c)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium" aria-label={`Edit ${c.name}`}><Pencil size={15} aria-hidden /> Edit</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden xl:block">
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Customer</th><th>Type</th><th className="num">Visits</th><th className="num">Spent so far</th><th>Last bought</th><th><span className="sr-only">Edit</span></th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const s = stats.get(c.id);
                  return (
                    <tr key={c.id} className={selected === c.id ? "[&>td]:bg-brand-soft/50" : "cursor-pointer"} onClick={() => setSelected(c.id)}>
                      <td><div className="flex items-center gap-3"><Avatar name={c.name} size={34} /><div><div className="font-semibold">{c.name}</div><div className="text-xs text-muted">{c.phone} · {c.city}</div></div></div></td>
                      <td><Badge tone={c.type === "Wholesale" ? "info" : "neutral"}>{c.type}</Badge></td>
                      <td className="num">{s?.bills ?? 0}</td>
                      <td className="num font-medium">{money(s?.spend ?? 0)}</td>
                      <td className="text-muted" title={fmtDate(s?.last)}>{s?.last ? timeAgo(s.last) : "Not yet"}</td>
                      <td className="num"><Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={(e) => { e.stopPropagation(); setEdit(c); }}><Pencil size={13} /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          </div>
        </Card>

        <Card className="hidden xl:block" title={sel ? <span className="flex items-center gap-2.5"><Avatar name={sel.name} size={28} />{sel.name}</span> : "Purchase history"} pad={false}>
          {!sel ? (
            <Empty title="Pick a customer" icon={MousePointerClick}>Click anyone on the left to see what they've bought.</Empty>
          ) : (
            history
          )}
        </Card>
      </div>

      <Modal open={!!sel && !wide} onClose={() => setSelected(null)} title={sel?.name ?? ""} subtitle={sel ? [sel.phone, sel.city].filter(Boolean).join(" · ") : undefined}>
        <div className="-mx-5 -my-4">{history}</div>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit customer" : "Add a customer"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name *" className="col-span-2"><input className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Phone"><input className="inp" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email"><input className="inp" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="City"><input className="inp" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            <Field label="Type">
              <select className="inp" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Customer["type"] })}>
                <option>Retail</option><option>Wholesale</option>
              </select>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
