"use client";
import Link from "next/link";
import { BookOpen, ChevronRight, CircleHelp, Settings, Shirt, ShoppingBag, Truck, Users, Factory, type LucideIcon } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";

const MAIN: { icon: LucideIcon; title: string; when: string; steps: string[]; href: string; cta: string }[] = [
  {
    icon: ShoppingBag,
    title: "Sell something",
    when: "A customer is buying clothes",
    steps: ["Open Make a sale", "Tap the product's size (tap again for more pieces)", "Choose how they paid, then Complete sale"],
    href: "/pos",
    cta: "Make a sale",
  },
  {
    icon: Truck,
    title: "Record stock that arrived",
    when: "A delivery came from a supplier",
    steps: ["Open Deliveries and press Stock arrived", "Pick the supplier and the products", "Type how many of each size came, then Save"],
    href: "/purchases?new=arrived",
    cta: "Stock arrived",
  },
  {
    icon: Shirt,
    title: "Check what's on the shelf",
    when: "You want to know what's left",
    steps: ["Open My stock", "Each box shows a size and how many are left", "Orange means running low, red means sold out"],
    href: "/inventory",
    cta: "My stock",
  },
];

const SETUP: { icon: LucideIcon; text: React.ReactNode }[] = [
  { icon: Settings, text: <>In <b>Settings</b>, add your shop name and address, then press <b>Start fresh with my own data</b> to remove the sample shop.</> },
  { icon: Factory, text: <>In <b>Suppliers</b>, add the people you buy from.</> },
  { icon: Shirt, text: <>In <b>My stock</b>, press <b>Add a product</b> for each item, and type how many of each size you have today.</> },
  { icon: ShoppingBag, text: <>That&apos;s it. Start selling. Stock goes down by itself with every sale and up with every delivery.</> },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "A customer wants to return something", a: <>Open <b>Past sales</b>, find their bill (search by bill number, name or phone), press <b>Return</b> next to the item, and say how many. The pieces go back into stock and the refund amount is shown.</> },
  { q: "The number on screen doesn't match the shelf", a: <>Open the product in <b>My stock</b>, press <b>Adjust stock</b>, choose the size and pick <i>I counted and the number is different</i>. Type how many to add (like 3) or remove (like −3). Damaged pieces have their own option.</> },
  { q: "How do I print a bill?", a: <>After a sale, press <b>Print bill</b>. For an older bill, open it from <b>Past sales</b> and press <b>Print invoice</b>.</> },
  { q: "What should I reorder?", a: <>Open <b>Reports</b> and look at <b>What to reorder</b>. It shows how fast each size is selling, when it will run out, and how many to order. The home page also tells you when sizes are running low.</> },
  { q: "I placed an order but the goods haven't come yet", a: <>Open <b>Deliveries</b>, press <b>Order stock</b> and choose <i>I&apos;ve ordered it, it hasn&apos;t come yet</i>. When the goods come, open the order and press <b>Goods arrived</b>. You can also record part of a delivery.</> },
  { q: "We don't sell a product any more", a: <>Open it and press <b>Archive</b>. It disappears from the sale screen and stock list but its old sales stay in your reports. You can restore it any time.</> },
  { q: "A product now comes in a new size", a: <>Open the product, press <b>Edit</b> and use <b>Add size</b>. Then record the new pieces with <b>Stock arrived</b> or <b>Adjust stock</b>.</> },
  { q: "Can I change the colours?", a: <>Yes. Open <b>Settings</b> and pick a scheme under <b>Colours</b>: Indigo, Terracotta, Teal, Royal maroon or Navy. It changes straight away and is remembered on that phone or computer.</> },
  { q: "How do I keep my data safe?", a: <>In <b>Settings</b>, press <b>Download backup</b> now and then. If anything goes wrong, use <b>Restore backup</b> with that file. <b>Check my data</b> makes sure every number adds up.</> },
];

const WORDS: [string, string][] = [
  ["Stock", "The pieces you have in the shop right now."],
  ["Size variation / SKU", "One size of one product, for example \"Black Tee, size M\". Each has its own code (SKU) and its own count."],
  ["Style code", "Your own short code for a product, like KP-TSH-1001. It is filled in for you."],
  ["MRP", "The maximum price printed on the tag. You can't sell for more than this."],
  ["You buy at / You sell at", "What you pay the supplier for one piece, and what the customer pays you."],
  ["Margin / Profit", "What you keep: selling price minus what you paid. Rent and salaries aren't counted."],
  ["GST", "Tax added to the bill. Clothes up to ₹2,500 a piece are usually 5%."],
  ["HSN code", "The GST category number for the item. It is printed on bills. Optional."],
  ["Delivery / Supplier order", "Stock you've bought from a supplier, whether it has arrived yet or not."],
  ["Stock history", "A diary of every time a count changed: sales, deliveries, returns and corrections."],
  ["Sell-through", "Out of every 100 pieces you bought, how many have sold."],
  ["Archive", "Hide a product you no longer sell, without losing its history."],
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" icon={CircleHelp} subtitle="Everything you need to know, in plain words" />

      <h2 className="mb-3 text-lg font-bold">The three things you&apos;ll do most</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {MAIN.map((m) => (
          <Card key={m.title}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><m.icon size={22} aria-hidden /></span>
              <div>
                <h3 className="font-bold">{m.title}</h3>
                <p className="text-xs text-muted">{m.when}</p>
              </div>
            </div>
            <ol className="mt-4 space-y-2 text-sm">
              {m.steps.map((s, i) => (
                <li key={s} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <Link href={m.href} className="mt-4 block"><Button variant="primary" className="w-full">{m.cta} <ChevronRight size={15} aria-hidden /></Button></Link>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Setting up your real shop" icon={Users}>
          <ol className="space-y-3">
            {SETUP.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{s.text}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="How do I…?" icon={CircleHelp} pad={false}>
          <div className="divide-y divide-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
                  {f.q}
                  <ChevronRight size={16} className="shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Words used in this app" icon={BookOpen} className="mt-4">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {WORDS.map(([w, d]) => (
            <div key={w}>
              <dt className="text-sm font-semibold">{w}</dt>
              <dd className="text-sm text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
