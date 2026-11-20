# Kapda Portal — clothing inventory management (demo)

Inventory, incoming stock, sales and reporting for a small clothing business.
Built with Next.js 15 (App Router), React 19, TypeScript and Tailwind CSS 4.

**Status:** working demo for client review. Data is saved in the browser for now; an online database
will be connected after the client approves the design (see *Connecting a database later* below).

**User guides**
- [Step-by-step guide (PDF, with screenshots)](docs/Kapda-Portal-User-Guide.pdf): for the client and shop staff
- [Admin guide (text)](docs/Admin-Guide.md): every page, the daily workflow and common jobs

## Run it

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # open http://localhost:3000
```

To try it on a phone on the same Wi-Fi: `npm run dev -- -H 0.0.0.0`, then open
`http://<this computer's IP address>:3000` on the phone.

For a faster production version: `npm run build && npm start`.

The demo loads with sample data (26 products, 6 suppliers, ~3 months of sales).
Everything you change is saved in your browser's localStorage.
Use **Settings → Bring back sample data** to start over, or **Start fresh with my own data** to enter your own.

## Works on phones, tablets and computers

It is designed for phones first, since that's where it gets used most.

- **Phones and tablets:** a bottom tab bar (Home, Sell, Stock, Deliveries, More), lists shown as cards
  instead of wide tables, forms that slide up from the bottom with the Save button always reachable,
  big tap targets (44px+), 16px typing boxes so iPhones don't zoom in, and a bill bar on the sale screen
  so the total and "Review & pay" are always under your thumb.
- **Laptops and desktops** (1280px and wider): sidebar menu and full tables.
- Tested at 320, 360, 390, 768, 1024, 1280 and 1920px wide. No page is ever wider than the screen.
- To use it like an app on a phone, open it in the browser and choose "Add to Home Screen".

## What's in it

New to it? Open **Help** in the menu. It explains the three everyday jobs in plain words.

| Page | What it does |
|---|---|
| Home | Greeting, a plain-language summary of the day, four big buttons for the common jobs, and a "Needs your attention" list (sold-out sizes, low stock, late deliveries, slow sellers) |
| Make a sale | Three steps: tap sizes to add them, check the bill, choose how they paid. Discounts, GST and notes are under "More options". It won't sell more than you have. |
| Past sales | Every bill, with search and filters. Bills can be printed (GST split into CGST and SGST) and returns taken. |
| My stock | Every product with pieces left in each size. Orange means running low, red means sold out. |
| Product page | Stock by size, what's on the way, sales, how long the stock will last, full history, "Adjust stock" for count corrections, damage and returns to supplier |
| Deliveries | "Stock arrived" adds goods straight away. "Order stock" tracks an order until it arrives, including part deliveries and late orders. |
| Stock history | A diary of every piece in or out, and why |
| Customers / Suppliers | Contacts, what they bought or supplied, pay-later amounts |
| Reports | A plain-English summary, profit, what sells (category, size, channel, payment, brand), what to reorder, slow movers, stock value |
| Settings | Shop details for bills, backup and restore, "Check my data", reset to sample data or start fresh |
| Help | How-to steps, FAQ and a glossary of every term used |

## Code layout

```
src/lib/actions.ts  ALL business rules (sell, receive, return, adjust...) as plain functions.
                    Nothing here touches React or the browser, so it is fully unit-tested and
                    can run unchanged on a server next to a database.
src/lib/store.tsx   connects actions.ts to React + localStorage (also syncs open tabs and
                    recovers safely from damaged saved data)
src/lib/types.ts    data model (maps 1:1 to future DB tables)
src/lib/seed.ts     sample shop generator
src/lib/utils.ts    money/date formatting, bill maths, safe CSV export
src/app/**          pages
src/components/**   shared UI (shell, forms, guides, badges, chart)
```

## Connecting a database later

All writes go through the action functions in `src/lib/store.tsx`
(`createSale`, `receivePurchaseOrder`, `adjustStock`, `saveProduct`, …).
To move to a real database:

1. Create tables from `src/lib/types.ts`: `products`, `product_variants` (size, sku, stock),
   `suppliers`, `customers`, `purchase_orders` + `purchase_order_items`,
   `sales` + `sale_items`, `stock_movements`, `settings`.
2. Add API routes (`src/app/api/...`) or Server Actions that perform each action
   **inside a transaction** (e.g. a sale = insert sale + items, decrement variant stock,
   insert stock movements, all or nothing).
3. Run the functions from `src/lib/actions.ts` inside those routes (they already contain every
   validation rule), then have `store.tsx` call the API instead of saving to localStorage.
   Pages don't need to change.

Good fits: PostgreSQL (Supabase / Neon) with Prisma or Drizzle.

## Testing

```bash
npm test             # unit tests: business rules, bill maths, CSV, sample data (no browser needed, ~1 s)
npm run dev          # then, in another terminal:
npm run test:e2e     # browser tests (BASE_URL / CHROME_PATH env vars to override)
npm run test:all     # both
```

**Unit tests** (`tests/unit/`, 78 tests): every action's normal path and every way it should refuse bad input
(negative, decimal or impossible quantities, overselling, over-receiving, wrong status changes, duplicates).
They include a stress test of 3,000 random actions, many deliberately invalid, that checks after every step
that no stock is negative or fractional, every count matches its history, and rejected actions change nothing.

**Browser tests** (`tests/full-feature-test.cjs`, 188 checks) drive the real app in headless Chrome:
every page and menu link, the first-visit help, every main flow end to end, double-click protection,
bad input typed into forms, damaged saved data, a full browser storage, two tabs open at once,
HTML/formula injection in names, keyboard-only use, an accessibility scan (axe-core) of every page and form,
a shop 5 times bigger than the sample, every page at 7 screen sizes from 320px phones to 1920px monitors,
and phone-specific checks (tab bar, bottom sheets, tap sizes, bill bar, a full sale on a phone).
