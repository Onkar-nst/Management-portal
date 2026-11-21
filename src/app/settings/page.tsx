"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, Download, Palette, RotateCcw, Settings, ShieldCheck, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { findDataProblems } from "@/lib/actions";
import { applyTheme, getTheme, THEMES, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button, Card, Confirm, Field, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { data, updateSettings, restoreBackup, resetDemo, clearAll, toast } = useStore();
  const [s, setS] = useState(data.settings);
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);
  const [health, setHealth] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setS(data.settings), [data.settings]);
  const [theme, setTheme] = useState<ThemeId>("indigo");
  useEffect(() => setTheme(getTheme()), []);
  const pickTheme = (id: ThemeId) => {
    applyTheme(id);
    setTheme(id);
    toast(`Colours changed to ${THEMES.find((t) => t.id === id)!.name}.`);
  };

  const save = () => {
    const r = updateSettings(s);
    if (!r.ok) return toast(r.error, "error");
    toast("Saved. Your bills will show the new details.");
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kapda-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const restore = async (f: File) => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(await f.text());
    } catch {}
    const r = restoreBackup(parsed);
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) return toast(r.error, "error");
    toast("Backup restored. Everything is back the way it was.");
  };

  return (
    <>
      <PageHeader title="Settings" icon={Settings} subtitle="Your shop details and your data" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Your shop" actions={<Button size="sm" variant="primary" onClick={save}>Save</Button>}>
          <div className="grid gap-4">
            <Field label="Your name" hint="Used to greet you on the home page"><input className="inp" value={s.ownerName ?? ""} onChange={(e) => setS({ ...s, ownerName: e.target.value })} placeholder="e.g. Ravi" /></Field>
            <Field label="Shop name"><input className="inp" value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} /></Field>
            <Field label="Address (printed on bills)"><textarea className="inp" rows={2} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="GSTIN" hint="Your GST number, printed on bills"><input className="inp" value={s.gstin} onChange={(e) => setS({ ...s, gstin: e.target.value.toUpperCase() })} /></Field>
              <Field label="Usual GST %" hint="Clothes up to ₹2,500 a piece: 5%">
                <select className="inp" value={s.defaultGstPct} onChange={(e) => setS({ ...s, defaultGstPct: +e.target.value })}>
                  {[0, 5, 12, 18].map((g) => <option key={g} value={g}>{g}%</option>)}
                </select>
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Colours" icon={Palette}>
            <p className="mb-3 text-sm text-muted">Pick the colours you like. It changes straight away and is remembered on this device.</p>
            <div role="radiogroup" aria-label="Colour scheme" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  onClick={() => pickTheme(t.id)}
                  className={cn("flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors", theme === t.id ? "border-brand bg-brand-soft/50" : "border-line hover:bg-hover")}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10" aria-hidden>
                    <span className="h-9 w-5" style={{ background: t.brand }} />
                    <span className="h-9 w-3" style={{ background: t.soft }} />
                    <span className="h-9 w-3" style={{ background: t.canvas }} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-semibold">{t.name}{t.id === "indigo" && <span className="font-normal text-muted"> (default)</span>}</span>
                    <span className="block text-xs text-muted">{t.feel}</span>
                  </span>
                  {theme === t.id && <Check size={17} className="shrink-0 text-brand" aria-hidden />}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Your data">
            <p className="mb-4 text-sm text-muted">
              Everything is saved in this browser: {data.products.length} products, {data.sales.length} bills, {data.purchaseOrders.length} supplier orders and {data.movements.length} stock changes. Download a backup now and then to keep it safe.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={backup}><Download size={15} /> Download backup</Button>
              <Button onClick={() => fileRef.current?.click()}><Upload size={15} /> Restore backup</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button onClick={() => setConfirm("reset")}><RotateCcw size={15} /> Bring back sample data</Button>
              <Button variant="danger" onClick={() => setConfirm("clear")}><Trash2 size={15} /> Start fresh with my own data</Button>
            </div>
          </Card>

          <Card title="Check my data" icon={ShieldCheck}>
            <p className="mb-3 text-sm text-muted">Makes sure every stock count matches its history and nothing is out of place.</p>
            <Button onClick={() => setHealth(findDataProblems(data))}>Run check</Button>
            {health && (
              health.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ok" role="status"><CircleCheck size={16} aria-hidden /> All good. Every number adds up.</p>
              ) : (
                <div className="mt-3 rounded-lg bg-bad-soft p-3 text-sm text-bad" role="alert">
                  <p className="flex items-center gap-2 font-semibold"><TriangleAlert size={16} aria-hidden /> Found {health.length} problem{health.length > 1 ? "s" : ""}:</p>
                  <ul className="mt-1 list-disc pl-6">{health.slice(0, 10).map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
              )
            )}
          </Card>
        </div>
      </div>

      <Confirm
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        onConfirm={() => { resetDemo(); toast("Sample data is back."); }}
        title="Bring back the sample data?"
        confirmLabel="Yes, reload samples"
      >
        This replaces everything with the sample shop. Anything you&apos;ve added or changed will be lost, so download a backup first if you need it.
      </Confirm>
      <Confirm
        open={confirm === "clear"}
        onClose={() => setConfirm(null)}
        onConfirm={() => { clearAll(); toast("All clear. Start by adding a supplier and your products."); }}
        title="Start fresh?"
        confirmLabel="Yes, erase everything"
        danger
      >
        This removes all products, suppliers, customers, bills and orders so you can enter your real shop. Your shop name and address are kept. This can&apos;t be undone.
      </Confirm>
    </>
  );
}
