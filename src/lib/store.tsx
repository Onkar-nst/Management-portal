"use client";
// Connects the business rules (./actions.ts) to React and browser storage.
//
// Today data is saved in localStorage. To use a database later, keep
// actions.ts as-is on the server (inside API routes / server actions, wrapped
// in a transaction), and make each function below call that API instead.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import type { AppData, Customer, MovementType, POStatus, Product, PurchaseOrder, Sale, Settings, Supplier } from "./types";
import * as A from "./actions";
import { buildSeed } from "./seed";

export const STORAGE_KEY = "kapda-portal-v1";

type Result = { ok: true; id?: string } | { ok: false; error: string };

interface Store {
  data: AppData;
  saveProduct: (p: Product) => Result;
  setProductActive: (id: string, active: boolean) => Result;
  deleteProduct: (id: string) => Result;
  saveSupplier: (s: Supplier) => Result;
  deleteSupplier: (id: string) => Result;
  saveCustomer: (c: Customer) => Result;
  createPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "poNumber">) => Result;
  setPOStatus: (id: string, status: POStatus) => Result;
  receivePurchaseOrder: (id: string, receipts: number[], invoiceNumber: string, note: string) => Result;
  createSale: (s: Omit<Sale, "id" | "invoiceNumber">) => Result;
  returnSaleItem: (saleId: string, itemIndex: number, qty: number, reason: string) => Result;
  adjustStock: (productId: string, size: string, delta: number, type: MovementType, note: string) => Result;
  updateSettings: (s: Settings) => Result;
  restoreBackup: (raw: unknown) => Result;
  resetDemo: () => void;
  clearAll: () => void;
  toast: (msg: string, kind?: "success" | "error") => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

type Toast = { id: number; msg: string; kind: "success" | "error" };

function loadSaved(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? A.parseAppData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recovered, setRecovered] = useState(false);
  // Mirror of the latest state so actions can validate synchronously.
  const ref = useRef<AppData | null>(null);

  const toast = useCallback((msg: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const save = useCallback(
    (next: AppData) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return true;
      } catch {
        toast("Your browser couldn't save this change (storage may be full or blocked). Download a backup from Settings.", "error");
        return false;
      }
    },
    [toast],
  );

  useEffect(() => {
    let hadSomething = false;
    try {
      hadSomething = !!localStorage.getItem(STORAGE_KEY);
    } catch {}
    const saved = loadSaved();
    const d = saved ?? buildSeed();
    if (!saved) {
      if (hadSomething) {
        // Keep the unreadable copy so nothing is lost for good.
        try {
          localStorage.setItem(`${STORAGE_KEY}-damaged-${Date.now()}`, localStorage.getItem(STORAGE_KEY) ?? "");
        } catch {}
        setRecovered(true);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); // keep the sample shop stable across visits
      } catch {}
    }
    ref.current = d;
    setData(d);

    // Another tab saved a change: pick it up instead of overwriting it later.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = A.parseAppData(JSON.parse(e.newValue));
        if (next) {
          ref.current = next;
          setData(next);
        }
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (recovered) toast("Your saved data couldn't be read, so the sample shop was loaded. A copy of the old data was kept.", "error");
  }, [recovered, toast]);

  const commit = useCallback(
    (next: AppData) => {
      ref.current = next;
      setData(next);
      save(next);
    },
    [save],
  );

  const actions = useMemo(() => {
    const cur = () => ref.current!;
    const run = (r: A.ActionResult): Result => {
      if (!r.ok) return r;
      commit(r.data);
      return { ok: true, id: r.id };
    };
    return {
      saveProduct: (p: Product) => run(A.saveProduct(cur(), p)),
      setProductActive: (id: string, active: boolean) => run(A.setProductActive(cur(), id, active)),
      deleteProduct: (id: string) => run(A.deleteProduct(cur(), id)),
      saveSupplier: (s: Supplier) => run(A.saveSupplier(cur(), s)),
      deleteSupplier: (id: string) => run(A.deleteSupplier(cur(), id)),
      saveCustomer: (c: Customer) => run(A.saveCustomer(cur(), c)),
      createPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "poNumber">) => run(A.createPurchaseOrder(cur(), po)),
      setPOStatus: (id: string, status: POStatus) => run(A.setPOStatus(cur(), id, status)),
      receivePurchaseOrder: (id: string, receipts: number[], inv: string, note: string) => run(A.receivePurchaseOrder(cur(), id, receipts, inv, note)),
      createSale: (s: Omit<Sale, "id" | "invoiceNumber">) => run(A.createSale(cur(), s)),
      returnSaleItem: (saleId: string, idx: number, qty: number, reason: string) => run(A.returnSaleItem(cur(), saleId, idx, qty, reason)),
      adjustStock: (pid: string, size: string, delta: number, type: MovementType, note: string) => run(A.adjustStock(cur(), pid, size, delta, type, note)),
      updateSettings: (s: Settings) => run(A.updateSettings(cur(), s)),
      restoreBackup: (raw: unknown): Result => {
        const d = A.parseAppData(raw);
        if (!d) return { ok: false, error: "Hmm, that file doesn't look like a Kapda backup." };
        commit(d);
        return { ok: true };
      },
      resetDemo: () => commit(buildSeed()),
      clearAll: () => commit(A.emptyShop(cur())),
    };
  }, [commit]);

  if (!data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-sm text-muted">
        <LoaderCircle size={26} className="animate-spin text-brand" aria-hidden />
        Getting your shop ready…
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ data, ...actions, toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2" aria-live="polite" data-testid="toasts">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-kind={t.kind}
            role={t.kind === "error" ? "alert" : "status"}
            className={`flex animate-pop items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl ${t.kind === "error" ? "bg-bad text-white" : "bg-ink text-white"}`}
          >
            {t.kind === "error" ? <TriangleAlert size={17} className="mt-px shrink-0" aria-hidden /> : <CircleCheck size={17} className="mt-px shrink-0 text-green-300" aria-hidden />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
