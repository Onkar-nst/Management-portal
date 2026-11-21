// Full feature + robustness test for the Kapda portal. Drives the real UI in
// headless Chrome and checks both what is on screen and the saved data.
//
//   npm run dev            (in one terminal)
//   npm run test:e2e       (in another)
//
// Env: BASE_URL (default http://localhost:3000), CHROME_PATH (default: macOS Chrome).
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const BASE = process.env.BASE_URL || "http://localhost:3000";
// Write screenshots/downloads outside the project, so the dev server doesn't rebuild mid-test.
const OUT = process.argv[2] || path.join(require("os").tmpdir(), "kapda-e2e");
const DL = path.join(OUT, "downloads");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
console.log(`Test output: ${OUT}`);

const results = [];
let section = "";
const check = (name, ok, detail = "") => {
  results.push({ section, name, ok: !!ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  ->  ${detail}` : ""}`);
};
const S = (name) => { section = name; console.log(`\n== ${name}`); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
  const errors = [];
  const watch = (pg) => {
    pg.on("pageerror", (e) => errors.push(`${pg.url()} :: ${e.message}`));
    pg.on("console", (m) => m.type() === "error" && errors.push(`${pg.url()} :: ${m.text()}`));
  };
  watch(page);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ready = (pg = page) => pg.waitForFunction(() => document.querySelector("h1") && !document.body.innerText.includes("Getting your shop ready"), { timeout: 15000 });
  const go = async (p, pg = page) => {
    // Switching Chrome between phone and desktop mode can reload the tab mid-navigation; retry once if so.
    for (let attempt = 0; ; attempt++) {
      try { await pg.goto(BASE + p, { waitUntil: "networkidle0" }); break; }
      catch (e) { if (attempt >= 2 || !/detached|context was destroyed/i.test(e.message)) throw e; await wait(500); }
    }
    await ready(pg); await wait(150);
  };
  const text = (pg = page) => pg.evaluate(() => document.body.innerText);
  const state = (pg = page) => pg.evaluate(() => JSON.parse(localStorage.getItem("kapda-portal-v1")));
  const h1 = () => page.$eval("h1", (e) => e.textContent.trim());
  const scopeFn = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')]; return d.length ? d[d.length - 1] : document; })()`;
  const click = async (label, { exact = false, within, pg = page } = {}) => {
    const ok = await pg.evaluate((label, exact, within, scopeFn) => {
      const scope = within ? document.querySelector(within) : eval(scopeFn);
      const els = [...scope.querySelectorAll("button, a, summary")].filter((b) => !b.disabled && b.offsetParent !== null);
      const t = (b) => (b.innerText || b.getAttribute("aria-label") || "").trim();
      const el = els.find((b) => (exact ? t(b) === label : t(b).includes(label))) || els.find((b) => (b.getAttribute("aria-label") || "").includes(label));
      if (el) { el.click(); return true; }
      return false;
    }, label, exact, within ?? null, scopeFn);
    if (!ok) throw new Error(`No clickable "${label}" on ${pg.url()}`);
    await wait(250);
  };
  const fill = async (label, value) => {
    const ok = await page.evaluate((label, value, scopeFn) => {
      const scope = eval(scopeFn);
      const lab = [...scope.querySelectorAll("label")].find((l) => l.querySelector("span")?.textContent.trim().startsWith(label));
      const el = lab?.querySelector("input, select, textarea");
      if (!el) return false;
      const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, label, value, scopeFn);
    if (!ok) throw new Error(`No field "${label}" on ${page.url()}`);
    await wait(120);
  };
  const setEl = async (selector, value, index = 0) => {
    const ok = await page.evaluate((selector, value, index) => {
      const el = document.querySelectorAll(selector)[index];
      if (!el) return false;
      const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, selector, value, index);
    if (!ok) throw new Error(`No element ${selector}[${index}] on ${page.url()}`);
    await wait(150);
  };
  const lastToast = async (pg = page) => {
    await wait(200);
    return pg.evaluate(() => { const t = [...document.querySelectorAll('[data-testid="toasts"] > div')]; const l = t[t.length - 1]; return l ? { kind: l.dataset.kind, text: l.innerText } : null; });
  };
  const dialogOpen = () => page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  const tableRows = () => page.evaluate(() => [...document.querySelectorAll("table.tbl tbody tr")].map((r) => r.innerText));
  const downloaded = async (re) => { for (let i = 0; i < 25; i++) { const f = fs.readdirSync(DL).find((n) => re.test(n) && !n.endsWith(".crdownload")); if (f) return path.join(DL, f); await wait(200); } return null; };
  const money = (s) => +String(s).replace(/[^\d.-]/g, "");
  const stockOf = (s, pid, size) => s.products.find((p) => p.id === pid).variants.find((v) => v.size === size).stock;
  const axe = async (label) => {
    await page.evaluate(AXE);
    const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => `${x.id} (${x.nodes.length})`));
    return v;
  };
  const fresh = async () => { await go("/"); await page.evaluate(() => localStorage.clear()); await go("/"); };
  const dismissGuides = () => page.evaluate(() => { ["kapda-welcome", "kapda-guide-inventory", "kapda-guide-deliveries", "kapda-guide-sales", "kapda-guide-movements"].forEach((k) => localStorage.setItem(k, "seen")); });

  try {
    // ───────────────────────────────────────────────
    S("1. Every page loads from the menu");
    await fresh();
    const navs = [["Home", "/"], ["Make a sale", "/pos"], ["Past sales", "/sales"], ["My stock", "/inventory"], ["Deliveries", "/purchases"], ["Stock history", "/movements"], ["Customers", "/customers"], ["Suppliers", "/suppliers"], ["Reports", "/reports"], ["Settings", "/settings"], ["Help", "/help"]];
    for (const [label, href] of navs) {
      await click(label, { within: "aside nav" });
      await page.waitForFunction((href) => location.pathname === href, {}, href);
      await ready();
      check(`Menu "${label}" opens ${href} ("${await h1()}")`, true);
    }
    let st = await state();
    check("Sample shop loaded (26 products, 6 suppliers, 150+ bills)", st.products.length === 26 && st.suppliers.length === 6 && st.sales.length > 150);
    check("Sample shop is saved straight away (stable between visits)", !!st);
    const ledgerOk = st.products.every((p) => p.variants.every((v) => v.stock === st.movements.filter((m) => m.productId === p.id && m.size === v.size).reduce((t, m) => t + m.qty, 0)));
    check("Every size's count equals its stock-history total", ledgerOk);

    // ───────────────────────────────────────────────
    S("2. First-time help: welcome note, page guides, Help page");
    await go("/");
    let t = await text();
    check("First visit shows a welcome note", t.includes("Welcome! This is a sample shop"));
    check("Home asks 'What would you like to do?' with 4 big buttons", t.includes("What would you like to do?") && ["Make a sale", "Stock arrived", "Add a product", "Check my stock"].every((x) => t.includes(x)));
    await click("Got it");
    await page.reload({ waitUntil: "networkidle0" }); await ready();
    check("Welcome note stays hidden after 'Got it'", !(await text()).includes("Welcome! This is a sample shop"));
    await go("/inventory");
    check("First visit to a page shows 'How this page works'", (await page.$('section[aria-label="How this page works"]')) !== null);
    await click("Got it");
    await page.reload({ waitUntil: "networkidle0" }); await ready();
    check("Guide collapses to a small link after 'Got it' and remembers it", (await page.$('section[aria-label="How this page works"]')) === null && (await text()).includes("How this page works"));
    await click("How this page works");
    check("…and the link opens it again", (await page.$('section[aria-label="How this page works"]')) !== null);
    await go("/help");
    t = await text();
    check("Help explains the 3 main jobs, setup, FAQ and words", ["The three things you'll do most", "Setting up your real shop", "How do I", "Words used in this app"].every((x) => t.includes(x)));
    const faqs = await page.$$eval("details", (d) => d.length);
    await page.evaluate(() => document.querySelectorAll("details summary").forEach((s) => s.click()));
    await wait(200);
    check(`All ${faqs} FAQ answers open`, await page.$$eval("details", (d) => d.every((x) => x.open)));
    await click("Stock arrived", { within: "main" });
    await page.waitForFunction(() => location.pathname === "/purchases");
    await wait(400);
    check("Help 'Stock arrived' button opens the delivery form in 'arrived' mode", (await dialogOpen()) && (await page.evaluate(() => document.querySelector('[role="dialog"] [role="radio"][aria-checked="true"]')?.innerText.includes("has arrived"))));
    await page.keyboard.press("Escape");
    await wait(200);
    check("Escape closes a dialog", !(await dialogOpen()));
    await dismissGuides();

    // ───────────────────────────────────────────────
    S("3. Home page");
    await go("/");
    t = await text();
    check("Greets the user", /Good (morning|afternoon|evening)|Working late/.test(t));
    check("Plain-language summary of today and this month", /today|No sales yet today/.test(t) && t.includes("This month you"));
    check("'Needs your attention' lists sold-out sizes", t.includes("sold out") && t.includes("See which"));
    await click("See which");
    await page.waitForFunction(() => location.pathname === "/inventory");
    await ready();
    const outRows = await tableRows();
    check("'See which' opens stock filtered to sold-out sizes", outRows.length > 0 && (await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText === "Sold-out sizes")?.className.includes("bg-ink"))));
    for (const [label, href] of [["Make a sale", "/pos"], ["Add a product", "/inventory"], ["Check my stock", "/inventory"]]) {
      await go("/");
      await click(label, { within: "main" });
      await page.waitForFunction((href) => location.pathname === href, {}, href);
      await ready();
      await wait(300);
      if (label === "Add a product") check("'Add a product' opens the new-product form", (await dialogOpen()) && (await text()).includes("Add a new product"));
      else check(`'${label}' goes to ${href}`, true);
      if (await dialogOpen()) await page.keyboard.press("Escape");
    }
    await go("/");
    const before = await page.$eval("main .h-40", (e) => e.parentElement.innerText.split("\n")[0]);
    await page.hover("main .h-40 > div:nth-child(5)");
    await wait(150);
    check("Sales chart shows the hovered day", before !== (await page.$eval("main .h-40", (e) => e.parentElement.innerText.split("\n")[0])));

    // ───────────────────────────────────────────────
    S("4. My stock: search, filters, export");
    await go("/inventory");
    await setEl('input[aria-label^="Search name"]', "jeans");
    let rows = await tableRows();
    check("Search 'jeans' finds only jeans", rows.length >= 3 && rows.every((r) => /jeans/i.test(r)), `${rows.length} rows`);
    await setEl('input[aria-label^="Search name"]', "KP-JEA-1008-32");
    rows = await tableRows();
    check("Search by size code finds that product", rows.length === 1 && rows[0].includes("Slim Fit Stretch Jeans"));
    await click("Clear search");
    await setEl('select[aria-label="Category"]', "Sarees");
    rows = await tableRows();
    check("Category filter (Sarees)", rows.length === 2 && rows.every((r) => r.includes("Sarees")));
    await setEl('select[aria-label="Category"]', "");
    check("Extra filters are tucked away until asked for", (await page.$('select[aria-label="Made for"]')) === null);
    await click("More filters");
    await setEl('select[aria-label="Made for"]', "Women");
    rows = await tableRows();
    check("'Made for' filter (Women)", rows.length > 0 && rows.every((r) => r.includes("Women")));
    await setEl('select[aria-label="Made for"]', "");
    await click("Running low");
    rows = await tableRows();
    check("'Running low' filter", rows.length > 0 && rows.every((r) => /Running low|sold out/i.test(r)));
    await click("All", { exact: true });
    await setEl('select[aria-label="Sort"]', "stock");
    const totals = await page.evaluate(() => [...document.querySelectorAll("table.tbl tbody tr")].map((r) => +r.cells[2].innerText));
    check("Sort 'Fewest left first' is in order", totals.length > 5 && totals.every((v, i) => i === 0 || totals[i - 1] <= v), totals.slice(0, 5).join(","));
    await page.evaluate(() => [...document.querySelectorAll("table.tbl tbody tr")][0].cells[3].click());
    await page.waitForFunction(() => /\/inventory\/prd_/.test(location.pathname));
    check("Clicking anywhere on a row opens the product", true);
    await go("/inventory");
    await click("Export CSV");
    const invCsv = await downloaded(/^inventory-.*\.csv$/);
    check("Stock CSV downloads, one row per size", invCsv && fs.readFileSync(invCsv, "utf8").split("\n")[0].startsWith("SKU,Product,Category") && fs.readFileSync(invCsv, "utf8").split("\n").length > 100);

    // ───────────────────────────────────────────────
    S("5. Add and edit products");
    await click("Add a product");
    check("Form shows only the essentials; extras are under 'More details'", !(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] label')].some((l) => l.innerText.startsWith("Style code")))) && (await text()).includes("More details (optional)"));
    await click("Add product", { exact: true });
    let toast = await lastToast();
    check("Empty name is rejected with a friendly message", toast?.kind === "error" && toast.text.includes("Please give the product a name"), toast?.text);
    await fill("What is it called?", "Test Hoodie");
    await fill("Category", "Jackets");
    await click("More details (optional)");
    const autoCode = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] label')].find((l) => l.innerText.startsWith("Style code")).querySelector("input").value);
    check("Style code is filled in automatically from the category", /^KP-JAC-\d{4}$/.test(autoCode), autoCode);
    await fill("Style code", "KP-TXS-1001");
    await click("Add product", { exact: true });
    toast = await lastToast();
    check("Duplicate style code is rejected", toast?.kind === "error" && toast.text.includes("already used"), toast?.text);
    await fill("Style code", "KP-TEST-1");
    await fill("Colour", "Charcoal");
    await fill("You buy at", 400);
    await fill("MRP on tag", 1200);
    await fill("You sell at", 1500);
    await click("Add product", { exact: true });
    toast = await lastToast();
    check("Selling price above MRP is rejected", toast?.kind === "error" && toast.text.includes("MRP"), toast?.text);
    await fill("You sell at", 1100);
    const marginText = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] label')].find((l) => l.innerText.startsWith("Your margin"))?.innerText);
    check("Margin is worked out as you type (64% · ₹700)", /64%/.test(marginText) && marginText.includes("700"), marginText);
    await setEl('[role="dialog"] input[aria-label="Pieces in size XS"]', "-5");
    await setEl('[role="dialog"] input[aria-label="Pieces in size S"]', "2.7");
    await setEl('[role="dialog"] input[aria-label="Pieces in size M"]', "5");
    await setEl('[role="dialog"] input[aria-label="Pieces in size L"]', "5");
    await setEl('[role="dialog"] input[aria-label="Pieces in size XL"]', "5");
    await setEl('[role="dialog"] input[aria-label="Pieces in size XXL"]', "5");
    check("Form shows the running total of pieces", (await text()).includes("22 pieces in total"));
    // double-click on Add product must create only one product
    await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.innerText.trim() === "Add product"); b.click(); b.click(); });
    await wait(300);
    st = await state();
    const hoodies = st.products.filter((p) => p.name === "Test Hoodie");
    let hoodie = hoodies[0];
    check("Double-clicking 'Add product' adds it only once", hoodies.length === 1, `${hoodies.length}`);
    check("Negative and decimal counts become whole numbers (XS: −5 → 0, S: 2.7 → 2)", stockOf(st, hoodie.id, "XS") === 0 && stockOf(st, hoodie.id, "S") === 2);
    check("Product saved with sizes and size codes", hoodie.variants.length === 6 && hoodie.variants[2].sku === "KP-TEST-1-M" && stockOf(st, hoodie.id, "M") === 5);
    check("Opening stock written to stock history", st.movements.filter((m) => m.productId === hoodie.id && m.type === "Opening Stock").reduce((a, m) => a + m.qty, 0) === 22);
    await go(`/inventory/${hoodie.id}`);
    check("Product page opens", (await h1()) === "Test Hoodie");
    await click("Edit");
    await fill("You sell at", 999);
    await setEl('[role="dialog"] input[placeholder^="Add size"]', "3xl");
    await click("Add size");
    await setEl('[role="dialog"] input[placeholder^="Add size"]', "M");
    await click("Add size");
    toast = await lastToast();
    check("Adding a size that's already there is refused", toast?.kind === "error" && toast.text.includes("already on the list"), toast?.text);
    await click("Save changes");
    st = await state();
    hoodie = st.products.find((p) => p.id === hoodie.id);
    check("Edit saves the new price", hoodie.sellingPrice === 999);
    check("Edit adds the new size (3XL) with 0 pieces", hoodie.variants.length === 7 && hoodie.variants.at(-1).size === "3XL" && hoodie.variants.at(-1).stock === 0);

    // ───────────────────────────────────────────────
    S("6. Fixing stock counts");
    const adjust = async (size, type, qty, note) => {
      await click("Adjust stock");
      await page.evaluate((size, type) => {
        const sels = document.querySelectorAll('[role="dialog"] select');
        const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("change", { bubbles: true })); };
        set(sels[0], size);
        set(sels[1], type);
      }, size, type);
      await wait(150);
      await setEl('[role="dialog"] input[type="number"]', qty);
      await fill("Note", note);
      await click("Save adjustment");
      return lastToast();
    };
    toast = await adjust("M", "Adjustment", 3, "Recount");
    st = await state();
    check("Count correction +3 (M: 5 → 8)", stockOf(st, hoodie.id, "M") === 8, toast?.text);
    toast = await adjust("M", "Damaged", 2, "Torn seam");
    st = await state();
    check("Damaged −2 (M: 8 → 6)", stockOf(st, hoodie.id, "M") === 6);
    check("Both recorded in stock history with notes", st.movements.some((m) => m.productId === hoodie.id && m.type === "Damaged" && m.qty === -2 && m.note === "Torn seam"));
    toast = await adjust("M", "Damaged", 100, "too many");
    check("Can't take stock below zero", toast?.kind === "error" && toast.text.includes("below zero"), toast?.text);
    await page.keyboard.press("Escape");
    toast = await adjust("M", "Adjustment", "1.5", "half");
    check("Can't adjust by half a piece", toast?.kind === "error" && toast.text.includes("whole number"), toast?.text);
    await page.keyboard.press("Escape");
    t = await text();
    check("Product history is in plain words", t.includes("Damaged") && t.includes("Count correction") && t.includes("just now"));

    // ───────────────────────────────────────────────
    S("7. Archive, restore, delete");
    await click("Archive");
    check("Archive asks first", (await dialogOpen()) && (await text()).includes("Archive Test Hoodie?"));
    await click("Yes, archive it");
    st = await state();
    check("Archived", st.products.find((p) => p.id === hoodie.id).active === false);
    await go("/inventory");
    await setEl('input[aria-label^="Search name"]', "Test Hoodie");
    check("Archived product hidden from My stock", (await tableRows()).length === 0);
    await click("More filters");
    await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.innerText.includes("Show archived")).querySelector("input").click());
    await wait(150);
    check("…shown under 'Show archived products'", (await tableRows()).some((r) => r.includes("Test Hoodie")));
    await go("/pos");
    check("Archived product hidden from the sale screen", !(await text()).includes("Test Hoodie"));
    await go(`/inventory/${hoodie.id}`);
    await click("Restore");
    check("Restore brings it back", (await state()).products.find((p) => p.id === hoodie.id).active === true);
    await go("/inventory/prd_1");
    await click("Delete product");
    await click("Delete forever");
    toast = await lastToast();
    check("Product with sales can't be deleted", toast?.kind === "error" && (await state()).products.some((p) => p.id === "prd_1"), toast?.text);
    await go(`/inventory/${hoodie.id}`);
    await click("Delete product");
    check("Delete warns it can't be undone", (await text()).includes("can't be undone"));
    await click("Delete forever");
    await page.waitForFunction(() => location.pathname === "/inventory");
    st = await state();
    check("Product without sales is deleted along with its history", !st.products.some((p) => p.id === hoodie.id) && !st.movements.some((m) => m.productId === hoodie.id));

    // ───────────────────────────────────────────────
    S("8. Making a sale");
    await go("/pos");
    t = await text();
    check("Sale screen shows 3 numbered steps", ["Pick what they're buying", "Check the bill", "Customer and payment"].every((x) => t.includes(x)));
    check("Complete button is disabled with an empty bill", await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Complete sale")).disabled));
    const tap = (name, color, size) => page.evaluate((name, color, size) => {
      const card = [...document.querySelectorAll("main .rounded-xl.border")].find((d) => d.innerText.includes(name) && d.innerText.includes(color));
      [...card.querySelectorAll("button")].find((b) => b.innerText.split("\n")[0] === size).click();
    }, name, color, size);
    st = await state();
    const saree = st.products.find((p) => p.name === "Banarasi Silk Saree");
    const sareeStock = saree.variants[0].stock;
    for (let i = 0; i < sareeStock; i++) { await tap("Banarasi Silk Saree", "Red & Gold", "Free"); await wait(80); }
    check(`Size button greys out once all ${sareeStock} are in the bill`, await page.evaluate(() => {
      const card = [...document.querySelectorAll("main .rounded-xl.border")].find((d) => d.innerText.includes("Banarasi Silk Saree"));
      return [...card.querySelectorAll("button")].find((b) => b.innerText.startsWith("Free")).disabled;
    }));
    await page.evaluate(() => document.querySelector('button[aria-label="Increase"]').click());
    toast = await lastToast();
    check("'+' won't go past what's in stock", toast?.kind === "error" && toast.text.includes(`only ${sareeStock} left`), toast?.text);
    await setEl('input[aria-label^="Search or scan"]', "KP-TXS-1004");
    await tap("Polo T-Shirt", "Navy", "M");
    await tap("Polo T-Shirt", "Navy", "M");
    await setEl('input[aria-label^="Search or scan"]', "");
    const polo = st.products.find((p) => p.name === "Polo T-Shirt");
    const editBtns = await page.$$eval("button", (bs) => bs.filter((b) => b.innerText === "Change price").length);
    check("Price changes are hidden behind 'Change price'", editBtns === 2 && (await page.$$('input[max="100"]')).length === 0);
    await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.innerText === "Change price")[1].click());
    await wait(150);
    await fill("Discount %", 10);
    await click("More options");
    await fill("Discount on whole bill", 5);
    await fill("GST", 12);
    await click("Card", { exact: true, within: '[role="radiogroup"][aria-label="Paid by"]' });
    check("'Paid by' uses big buttons (Card selected)", await page.evaluate(() => document.querySelector('[aria-label="Paid by"] [aria-checked="true"]').innerText.trim() === "Card"));
    const lines = [{ price: saree.sellingPrice, qty: sareeStock, disc: 0 }, { price: polo.sellingPrice, qty: 2, disc: 10 }];
    const expTotal = Math.round(lines.reduce((t, l) => t + l.qty * l.price * (1 - l.disc / 100), 0) * 0.95 * 1.12);
    const shown = await page.evaluate(() => [...document.querySelectorAll("dl div")].find((d) => d.innerText.startsWith("To pay"))?.innerText);
    check(`Bill maths: line 10% + bill 5% + GST 12% = ₹${expTotal}`, Math.abs(money(shown.split("\n")[1]) - expTotal) <= 1, shown);
    check("Shows how much the customer saves", (await text()).includes("Customer saves"));
    const preSale = await state();
    await fill("Customer", "cus_5");
    check("Picking a wholesale customer switches to Wholesale", await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.innerText.startsWith("Sold through")).querySelector("select").value === "Wholesale"));
    // double-click Complete sale
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Complete sale")); b.click(); b.click(); });
    await page.waitForFunction(() => /\/sales\/.+/.test(location.pathname), { timeout: 5000 });
    await ready();
    t = await text();
    st = await state();
    check("Double-clicking 'Complete sale' makes only one bill", st.sales.length === preSale.sales.length + 1, `${preSale.sales.length} → ${st.sales.length}`);
    check("Bill opens with 'Sale complete!'", t.includes("Sale complete!") && t.includes("Next sale"));
    const sale = st.sales[0];
    check("Sale saved with both items, customer and payment", sale.items.length === 2 && sale.customerName === "Style Point Boutique" && sale.paymentMethod === "Card" && sale.channel === "Wholesale" && sale.gstPct === 12);
    check("Saree now at 0", stockOf(st, saree.id, "Free") === 0);
    check("Polo M down by 2", stockOf(st, polo.id, "M") === stockOf(preSale, polo.id, "M") - 2);
    check("'Sold' entries added to stock history", st.movements.filter((m) => m.reference === sale.invoiceNumber && m.type === "Sale Out").length === 2);
    const invTotal = await page.evaluate(() => [...document.querySelectorAll("dl div")].find((d) => d.innerText.startsWith("Total"))?.innerText);
    check("Bill total matches the sale screen", Math.abs(money(invTotal.split("\n")[1]) - expTotal) <= 1, invTotal);
    check("Bill splits GST into CGST + SGST (6% + 6%)", t.includes("CGST (6%)") && t.includes("SGST (6%)"));
    check("Bill shows shop name, GSTIN and bill number", t.includes(st.settings.companyName) && t.includes(st.settings.gstin) && t.includes(sale.invoiceNumber));
    await page.emulateMediaType("print");
    const printHidden = await page.evaluate(() => [...document.querySelectorAll("aside, .print\\:hidden")].every((e) => getComputedStyle(e).display === "none"));
    await page.emulateMediaType("screen");
    check("Printing hides menus and buttons", printHidden);

    // ───────────────────────────────────────────────
    S("9. Returns");
    await click("Return", { within: "table.tbl tbody tr:nth-child(2)" });
    await fill("Quantity", 1);
    await fill("Why?", "Size exchange");
    await click("Return to stock");
    toast = await lastToast();
    const afterRet = await state();
    check("Return puts 1 piece back", stockOf(afterRet, polo.id, "M") === stockOf(st, polo.id, "M") + 1, toast?.text);
    check("Bill line shows '−1 returned' and the refund is shown", (await text()).includes("−1 returned") && toast?.text.includes("Refund the customer"));
    check("Logged as 'Customer return'", afterRet.movements.some((m) => m.type === "Customer Return" && m.reference === sale.invoiceNumber && m.note === "Size exchange"));
    await click("Return", { within: "table.tbl tbody tr:nth-child(2)" });
    await fill("Quantity", 5);
    await click("Return to stock");
    toast = await lastToast();
    check("Can't return more than was bought", toast?.kind === "error" && toast.text.includes("between 1 and 1"), toast?.text);
    await page.keyboard.press("Escape");

    // ───────────────────────────────────────────────
    S("10. Deliveries");
    await go("/purchases");
    rows = await tableRows();
    check("Default view shows only orders not yet arrived", rows.length === 4 && rows.every((r) => /Ordered|On the way|Partly arrived/.test(r)));
    check("Late delivery is marked", rows.some((r) => r.includes("late")));
    await click("Received", { exact: true });
    rows = await tableRows();
    check("'Received' tab", rows.length > 0 && rows.every((r) => r.includes("Received")));
    await click("All", { exact: true });
    await setEl('input[aria-label^="PO, supplier"]', "Ludhiana");
    rows = await tableRows();
    check("Search by supplier", rows.length > 0 && rows.every((r) => r.includes("Ludhiana")));
    await click("Order stock");
    check("'Order stock' opens in 'not come yet' mode with dates", (await page.evaluate(() => document.querySelector('[role="dialog"] [role="radio"][aria-checked="true"]').innerText.includes("hasn't come yet"))) && (await text()).includes("Expected delivery"));
    await click("Save order");
    toast = await lastToast();
    check("Empty order rejected", toast?.kind === "error" && toast.text.includes("Add at least one product"), toast?.text);
    await fill("Supplier", "sup_3");
    await setEl('[role="dialog"] select[aria-label="Choose a product to add"]', "prd_8");
    await setEl('[role="dialog"] select[aria-label="Choose a product to add"]', "prd_9");
    await page.evaluate(() => {
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      document.querySelectorAll('[role="dialog"] input[placeholder="0"]').forEach((i, n) => { s.call(i, String(n + 1)); i.dispatchEvent(new Event("input", { bubbles: true })); });
    });
    await wait(150);
    check("Order form adds up pieces (78)", (await page.evaluate(() => document.querySelector('[role="dialog"] .border-t:last-child')?.innerText ?? document.querySelector('[role="dialog"]').innerText)).includes("78"));
    const preOrder = await state();
    await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.innerText.trim() === "Save order"); b.click(); b.click(); });
    await page.waitForFunction(() => /\/purchases\/po_/.test(location.pathname), { timeout: 5000 });
    await ready();
    st = await state();
    check("Double-clicking 'Save order' saves it only once", st.purchaseOrders.length === preOrder.purchaseOrders.length + 1);
    let po = st.purchaseOrders[0];
    check("Order saved as 'Ordered' with 12 lines; stock not touched yet", po.status === "Ordered" && po.items.length === 12 && stockOf(st, "prd_8", "28") === stockOf(preOrder, "prd_8", "28"));
    await click("dispatched");
    check("'It's been dispatched' → On the way", (await state()).purchaseOrders[0].status === "In Transit");
    const preRecv = await state();
    await click("Goods arrived");
    await page.evaluate(() => {
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      document.querySelectorAll('[role="dialog"] tbody input').forEach((i, n) => { if (n > 0) { s.call(i, "0"); i.dispatchEvent(new Event("input", { bubbles: true })); } });
    });
    await fill("Supplier invoice", "INV-TEST-1");
    await click("Add to stock");
    st = await state();
    po = st.purchaseOrders[0];
    check("Part delivery → 'Partly arrived', only that piece added", po.status === "Partially Received" && po.items[0].qtyReceived === 1 && stockOf(st, "prd_8", "28") === stockOf(preRecv, "prd_8", "28") + 1 && stockOf(st, "prd_8", "30") === stockOf(preRecv, "prd_8", "30"));
    await click("Goods arrived");
    await click("Add to stock");
    st = await state();
    po = st.purchaseOrders[0];
    check("Rest arrives → 'Received', all 78 pieces logged", po.status === "Received" && st.movements.filter((m) => m.reference === po.poNumber && m.type === "Purchase In").reduce((t, m) => t + m.qty, 0) === 78);
    check("'Goods arrived' button gone once complete", !(await text()).includes("Goods arrived"));
    await go("/purchases?new=arrived");
    await wait(300);
    await setEl('[role="dialog"] select[aria-label="Choose a product to add"]', "prd_1");
    await setEl('[role="dialog"] input[aria-label="Classic Crew Neck Tee size M"]', "4.9");
    await setEl('[role="dialog"] input[aria-label="Classic Crew Neck Tee size L"]', "-3");
    await setEl('[role="dialog"] input[aria-label="Classic Crew Neck Tee size XL"]', "2");
    const preDirect = await state();
    await click("Save & add to stock");
    await page.waitForFunction(() => /\/purchases\/po_/.test(location.pathname), { timeout: 5000 });
    st = await state();
    check("'Stock has arrived' adds stock immediately (M +4 from 4.9, L ignored from −3, XL +2)",
      st.purchaseOrders[0].status === "Received" && stockOf(st, "prd_1", "M") === stockOf(preDirect, "prd_1", "M") + 4 && stockOf(st, "prd_1", "L") === stockOf(preDirect, "prd_1", "L") && stockOf(st, "prd_1", "XL") === stockOf(preDirect, "prd_1", "XL") + 2);
    const ordered = st.purchaseOrders.find((p) => p.status === "Ordered");
    await go(`/purchases/${ordered.id}`);
    await click("Cancel order");
    check("Cancel asks first", (await text()).includes("Cancel this order?"));
    await click("Yes, cancel it");
    check("Order cancelled", (await state()).purchaseOrders.find((p) => p.id === ordered.id).status === "Cancelled");

    // ───────────────────────────────────────────────
    S("11. Past sales and stock history");
    await go("/sales");
    const rangeCount = async (v) => { await setEl('select[aria-label="Date range"]', v); return (await tableRows()).length; };
    const n7 = await rangeCount("7"), nAll = await rangeCount("all");
    check("Date range changes the list (7 days < all time)", n7 > 0 && n7 < nAll, `${n7} vs ${nAll}`);
    await setEl('select[aria-label="Sold through"]', "Wholesale");
    rows = await tableRows();
    check("Filter by where it was sold (Wholesale)", rows.length > 0 && rows.every((r) => r.includes("Wholesale")));
    await setEl('select[aria-label="Sold through"]', "");
    await setEl('select[aria-label="Paid by"]', "Credit");
    rows = await tableRows();
    check("Filter by payment (Pay later)", rows.length > 0 && rows.every((r) => r.includes("On credit")));
    await setEl('select[aria-label="Paid by"]', "");
    await setEl('input[aria-label^="Invoice, customer"]', sale.invoiceNumber);
    rows = await tableRows();
    check("Search by bill number; returned bill tagged", rows.length === 1 && rows[0].includes("Style Point Boutique") && rows[0].includes("Return"));
    await click("Export CSV");
    check("Sales CSV downloads", !!(await downloaded(/^sales\.csv$/)));
    await go("/movements");
    await setEl('select[aria-label="What happened"]', "Damaged");
    rows = await tableRows();
    check("Stock history filter (Damaged)", rows.length > 0 && rows.every((r) => r.includes("Damaged")));
    await setEl('select[aria-label="What happened"]', "");
    await setEl('input[aria-label^="Product, PO"]', sale.invoiceNumber);
    check("Search a bill in stock history (2 sold + 1 returned)", (await tableRows()).length === 3);
    await click("Export");
    check("Stock history CSV downloads", !!(await downloaded(/^stock-ledger\.csv$/)));

    // ───────────────────────────────────────────────
    S("12. Customers and suppliers");
    await go("/customers");
    await click("Add a customer");
    await click("Save");
    check("Customer needs a name", (await lastToast())?.kind === "error");
    await fill("Name", "Meera Iyer");
    await fill("Phone", "+91 90000 11111");
    await fill("City", "Pune");
    await click("Save");
    check("Customer added", (await state()).customers.some((c) => c.name === "Meera Iyer"));
    await click("Add a customer");
    await fill("Name", "Someone Else");
    await fill("Phone", "9000011111");
    await click("Save");
    toast = await lastToast();
    check("Two customers can't share a phone number", toast?.kind === "error" && toast.text.includes("phone"), toast?.text);
    await page.keyboard.press("Escape");
    await click("Edit Meera Iyer");
    await fill("City", "Mumbai");
    await click("Save");
    check("Customer edited", (await state()).customers.find((c) => c.name === "Meera Iyer").city === "Mumbai");
    await page.evaluate(() => [...document.querySelectorAll("table.tbl tbody tr")].find((r) => r.innerText.includes("Style Point Boutique")).click());
    await wait(200);
    check("Selecting a customer shows their bills", (await text()).includes(sale.invoiceNumber));
    await go("/suppliers");
    await click("Add a supplier");
    await fill("Company name", "Kolkata Cotton Co.");
    await click("Save");
    check("Supplier added", (await state()).suppliers.some((s) => s.name === "Kolkata Cotton Co."));
    await click("Add a supplier");
    await fill("Company name", "kolkata cotton co.");
    await click("Save");
    toast = await lastToast();
    check("Duplicate supplier name refused", toast?.kind === "error" && toast.text.includes("already have"), toast?.text);
    await page.keyboard.press("Escape");
    await click("Remove Tirupur Knit Exports");
    await click("Remove supplier");
    check("Supplier with products can't be removed", (await lastToast())?.kind === "error" && (await state()).suppliers.some((s) => s.id === "sup_1"));
    await click("Remove Kolkata Cotton Co.");
    await click("Remove supplier");
    check("Unused supplier removed", !(await state()).suppliers.some((s) => s.name === "Kolkata Cotton Co."));

    // ───────────────────────────────────────────────
    S("13. Reports");
    await go("/reports");
    const summary = () => page.$eval('[data-testid="report-summary"]', (e) => e.innerText);
    check("Reports open with a plain-English summary", /In the last 30 days, you made \d+ sales and sold [\d,]+ pieces/.test(await summary()), await summary());
    const salesStat = () => page.evaluate(() => [...document.querySelectorAll("main div")].find((d) => d.className.includes("rounded-2xl") && d.innerText.startsWith("Sales"))?.innerText.split("\n").find((l) => l.startsWith("₹")));
    await setEl('select[aria-label="Period"]', "7");
    const s7 = money(await salesStat());
    await setEl('select[aria-label="Period"]', "all");
    const sAll = money(await salesStat());
    check("Changing the period changes the numbers", s7 > 0 && s7 < sAll, `${s7} vs ${sAll}`);
    check("All-time summary reads naturally", (await summary()).startsWith("Since you started, you made"));
    t = await text();
    check("Profit, categories, sizes, channels, payments, brands shown", ["Profit", "Which categories make money", "Which sizes sell most", "Where you sell", "How people pay", "Brands"].every((x) => t.includes(x)));
    check("Reorder suggestions listed", (await page.$$eval("#reorder tbody tr", (r) => r.length)) > 0);
    await click("CSV");
    check("Reorder list CSV downloads", !!(await downloaded(/^reorder-suggestions\.csv$/)));

    // ───────────────────────────────────────────────
    S("14. Settings, backup, restore, data check");
    await go("/settings");
    await click("Run check");
    check("'Check my data' says everything adds up after all the tests so far", (await text()).includes("All good. Every number adds up."));
    await fill("Shop name", "   ");
    await click("Save");
    check("Shop name can't be blank", (await lastToast())?.kind === "error");
    await fill("Your name", "Asha");
    await fill("Shop name", "Asha Fashions");
    await click("Save");
    check("Shop name updates the menu", (await page.$eval("aside", (a) => a.innerText)).includes("Asha Fashions"));
    await go("/");
    check("Home greets by name", (await h1()).includes("Asha"));
    await go(`/sales/${sale.id}`);
    check("Bill uses the new shop name", (await text()).includes("Asha Fashions"));
    await go("/settings");
    await click("Download backup");
    const backup = await downloaded(/^kapda-backup-.*\.json$/);
    check("Backup downloads", !!backup && JSON.parse(fs.readFileSync(backup, "utf8")).products.length === 26);
    const junk = path.join(OUT, "not-a-backup.json");
    fs.writeFileSync(junk, JSON.stringify({ hello: "world" }));
    let [chooser] = await Promise.all([page.waitForFileChooser(), click("Restore backup")]);
    await chooser.accept([junk]);
    toast = await lastToast();
    check("A wrong file is refused and nothing changes", toast?.kind === "error" && (await state()).products.length === 26, toast?.text);
    await click("Start fresh");
    await click("Yes, erase everything");
    st = await state();
    check("'Start fresh' empties everything but keeps the shop name", st.products.length === 0 && st.sales.length === 0 && st.settings.companyName === "Asha Fashions");
    await go("/inventory");
    check("Empty stock page invites you to add a product", (await text()).includes("Add your first product"));
    await go("/suppliers");
    check("Empty suppliers page invites you to add one", (await text()).includes("Add your first supplier"));
    await go("/");
    t = await text();
    check("Empty home page still works", t.includes("No sales yet today") && t.includes("All caught up"));
    for (const p of ["/pos", "/sales", "/purchases", "/movements", "/customers", "/reports"]) await go(p);
    check("Every page works with an empty shop", errors.length === 0, errors.slice(-2).join(" | "));
    await go("/settings");
    [chooser] = await Promise.all([page.waitForFileChooser(), click("Restore backup")]);
    await chooser.accept([backup]);
    await wait(400);
    st = await state();
    check("Restore brings everything back", st.products.length === 26 && st.sales.some((s) => s.id === sale.id));
    await click("Bring back sample data");
    await click("Yes, reload samples");
    check("'Bring back sample data' resets the demo", (await state()).products.length === 26 && !(await state()).sales.some((s) => s.id === sale.id));
    await page.reload({ waitUntil: "networkidle0" });
    await ready();
    check("Data survives a page reload", (await state()).products.length === 26);

    // ───────────────────────────────────────────────
    S("15. Damaged or blocked storage");
    await page.evaluate(() => localStorage.setItem("kapda-portal-v1", "{this is not json"));
    await page.reload({ waitUntil: "networkidle0" });
    await ready();
    toast = await lastToast();
    st = await state();
    const keptCopy = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("kapda-portal-v1-damaged-")));
    check("Unreadable saved data: app still opens with the sample shop", st && st.products.length === 26);
    check("…tells you, and keeps a copy of the old data", toast?.kind === "error" && toast.text.includes("couldn't be read") && keptCopy, toast?.text);
    await page.evaluate(() => localStorage.setItem("kapda-portal-v1", JSON.stringify({ products: "oops", sales: [] })));
    await page.reload({ waitUntil: "networkidle0" });
    await ready();
    check("Saved data with the wrong shape is handled the same way", (await state()).products.length === 26);
    await go("/inventory/prd_1");
    await page.evaluate(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); }; });
    await click("Adjust stock");
    await setEl('[role="dialog"] input[type="number"]', 1);
    await click("Save adjustment");
    await wait(200);
    const toasts = await page.evaluate(() => [...document.querySelectorAll('[data-testid="toasts"] > div')].map((d) => d.innerText).join(" | "));
    await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
    check("If the browser can't save, you get a clear warning", toasts.includes("couldn't save this change"), toasts);

    // ───────────────────────────────────────────────
    S("16. Two tabs open at once");
    await fresh();
    await dismissGuides();
    const page2 = await browser.newPage();
    watch(page2);
    await page2.setViewport({ width: 1200, height: 800 });
    await go("/inventory/prd_4", page2);
    const before2 = await page2.evaluate(() => document.body.innerText.match(/Pieces left\s*\n\s*(\d+)/)?.[1]);
    await go("/inventory/prd_4");
    await click("Adjust stock");
    await setEl('[role="dialog"] input[type="number"]', 7);
    await click("Save adjustment");
    await wait(500);
    const after2 = await page2.evaluate(() => document.body.innerText.match(/Pieces left\s*\n\s*(\d+)/)?.[1]);
    check("A change in one tab shows up in the other without reloading", +after2 === +before2 + 7, `${before2} → ${after2}`);
    await go("/inventory/prd_4", page2);
    await page2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Adjust stock")).click());
    await wait(200);
    await page2.evaluate(() => { const i = document.querySelector('[role="dialog"] input[type="number"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "2"); i.dispatchEvent(new Event("input", { bubbles: true })); });
    await page2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Save adjustment")).click());
    await wait(300);
    st = await state();
    check("…and the second tab's change doesn't wipe out the first tab's (+7 then +2 both kept)", st.movements.filter((m) => m.productId === "prd_4" && m.type === "Adjustment" && m.reference === "ADJ").map((m) => m.qty).sort().join(",") === "2,7");
    await page2.close();

    // ───────────────────────────────────────────────
    S("17. Odd and unsafe text");
    await go("/inventory");
    await click("Add a product");
    await fill("What is it called?", '<img src=x onerror="window.__xss=1">=HYPERLINK("x")');
    await click("Add product", { exact: true });
    await wait(300);
    await go("/inventory");
    check("HTML in a product name shows as plain text and never runs", (await page.evaluate(() => window.__xss)) === undefined && (await text()).includes("<img src=x"));
    await click("Export CSV");
    const inv2 = await downloaded(/^inventory-.*\(1\)\.csv$|^inventory-.*\.csv$/);
    const csvTxt = fs.readdirSync(DL).filter((n) => n.startsWith("inventory-")).map((n) => fs.readFileSync(path.join(DL, n), "utf8")).join("\n");
    check("Spreadsheet formulas in names are made safe in exports", !!inv2 && !/(^|,)"?=HYPERLINK/m.test(csvTxt));
    await go("/customers");
    await click("Add a customer");
    await fill("Name", "Ünïcødé ग्राहक 李");
    await click("Save");
    check("Names in any language are kept exactly", (await state()).customers.some((c) => c.name === "Ünïcødé ग्राहक 李") && (await text()).includes("Ünïcødé ग्राहक 李"));

    // ───────────────────────────────────────────────
    S("18. Keyboard only");
    await go("/");
    await page.focus('a[href="/pos"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.pathname === "/pos");
    check("Menu links work with the keyboard", true);
    await go("/inventory");
    await page.focus("main button");
    let reached = false;
    for (let i = 0; i < 6 && !reached; i++) {
      if (await page.evaluate(() => document.activeElement?.innerText?.includes("Add a product"))) reached = true;
      else await page.keyboard.press("Tab");
    }
    await page.keyboard.press("Enter");
    await wait(300);
    check("'Add a product' can be reached with Tab and opened with Enter", reached && (await dialogOpen()));
    check("The name box is ready to type into", await page.evaluate(() => document.activeElement?.placeholder?.includes("Slim Fit")));
    await page.keyboard.press("Escape");

    // ───────────────────────────────────────────────
    S("19. Accessibility scan (screen readers, contrast, labels)");
    const a11y = [];
    for (const p of ["/", "/pos", "/sales", "/sales/sal_1", "/inventory", "/inventory/prd_8", "/purchases", "/purchases/po_9", "/movements", "/customers", "/suppliers", "/reports", "/settings", "/help"]) {
      await go(p);
      const v = await axe(p);
      if (v.length) a11y.push(`${p}: ${v.join(", ")}`);
    }
    await go("/inventory?new=1"); await wait(300); await click("More details (optional)");
    let v = await axe(); if (v.length) a11y.push(`add-product form: ${v.join(", ")}`);
    await go("/purchases?new=arrived"); await wait(300);
    v = await axe(); if (v.length) a11y.push(`delivery form: ${v.join(", ")}`);
    await go("/pos"); await click("More options");
    v = await axe(); if (v.length) a11y.push(`sale options: ${v.join(", ")}`);
    check("No accessibility problems on any page or form", a11y.length === 0, a11y.join(" || "));

    // ───────────────────────────────────────────────
    S("20. A much bigger shop (speed)");
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("kapda-portal-v1"));
      const extraProducts = [];
      for (let k = 0; k < 4; k++)
        for (const p of d.products.slice(0, 26)) extraProducts.push({ ...p, id: `${p.id}_x${k}`, name: `${p.name} ${k + 2}`, styleCode: `${p.styleCode}-X${k}`, variants: p.variants.map((v) => ({ ...v, sku: `${v.sku}-X${k}` })) });
      const extraMoves = [];
      for (const p of extraProducts) for (const v of p.variants) extraMoves.push({ id: `mv_${p.id}_${v.size}`, date: new Date().toISOString(), productId: p.id, size: v.size, type: "Opening Stock", qty: v.stock, reference: "OPENING", note: "" });
      const extraSales = [];
      for (let k = 0; k < 4; k++) for (const s of d.sales) extraSales.push({ ...s, id: `${s.id}_x${k}`, invoiceNumber: `${s.invoiceNumber}-X${k}`, items: s.items.map((i) => ({ ...i, productId: `${i.productId}_x${k}` })) });
      d.products.push(...extraProducts);
      d.movements.push(...extraMoves);
      d.sales.push(...extraSales);
      localStorage.setItem("kapda-portal-v1", JSON.stringify(d));
    });
    st = await state();
    const sizeKb = Math.round(JSON.stringify(st).length / 1024);
    const timings = [];
    for (const p of ["/", "/inventory", "/pos", "/sales", "/reports", "/movements"]) {
      const t0 = Date.now();
      await go(p);
      timings.push([p, Date.now() - t0]);
    }
    const slowest = timings.reduce((a, b) => (b[1] > a[1] ? b : a));
    check(`5× bigger shop (${st.products.length} products, ${st.sales.length} bills, ${sizeKb} KB) loads every page in under 3 s`, slowest[1] < 3000, timings.map(([p, ms]) => `${p} ${ms}ms`).join(", "));
    console.log("     timings:", timings.map(([p, ms]) => `${p} ${ms}ms`).join(", "));
    await go("/pos");
    const t1 = Date.now();
    await setEl('input[aria-label^="Search or scan"]', "jeans");
    check("Searching the bigger shop is instant (< 300 ms)", Date.now() - t1 < 300 + 150, `${Date.now() - t1}ms`);

    // ───────────────────────────────────────────────
    S("21. Every screen size (phone, tablet, laptop, big monitor)");
    await fresh();
    await dismissGuides();
    const PAGES = ["/", "/pos", "/sales", "/sales/sal_1", "/inventory", "/inventory/prd_8", "/purchases", "/purchases/po_9", "/movements", "/customers", "/suppliers", "/reports", "/settings", "/help"];
    for (const [w, h, mobile, name] of [[320, 640, true, "small phone"], [360, 780, true, "Android phone"], [390, 844, true, "iPhone"], [768, 1024, true, "tablet"], [1024, 768, false, "laptop"], [1280, 800, false, "desktop"], [1920, 1080, false, "big monitor"]]) {
      await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
      await wait(300);
      const bad = [];
      for (const p of PAGES) {
        await go(p);
        // Compare against the real screen width: phones zoom out on wide pages, so innerWidth can't be trusted.
        const r = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          inner: [...document.querySelectorAll(".overflow-x-auto, .overflow-auto")].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 2).length,
        }));
        if (r.page > w + 1) bad.push(`${p} is ${r.page - w}px too wide`);
        if (r.inner) bad.push(`${p} has ${r.inner} box(es) scrolling sideways`);
      }
      check(`${name} (${w}px): all ${PAGES.length} pages fit, nothing scrolls sideways`, bad.length === 0, bad.join("; "));
    }

    S("22. Using it on a phone");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await go("/");
    const tabBar = await page.$('nav[aria-label="Quick"]');
    check("Phones get a bottom tab bar (Home, Sell, Stock, Deliveries, More)", !!tabBar && (await page.$eval('nav[aria-label="Quick"]', (n) => n.innerText.replace(/\d+/g, "").split("\n").filter(Boolean).join(","))) === "Home,Sell,Stock,Deliveries,More");
    check("The desktop sidebar is hidden on phones", await page.evaluate(() => getComputedStyle(document.querySelector("aside")).display === "none"));
    for (const [label, href] of [["Sell", "/pos"], ["Stock", "/inventory"], ["Deliveries", "/purchases"], ["Home", "/"]]) {
      await page.evaluate((label) => [...document.querySelectorAll('nav[aria-label="Quick"] a')].find((a) => a.innerText.includes(label)).click(), label);
      await page.waitForFunction((href) => location.pathname === href, {}, href);
      await ready();
    }
    check("Each tab opens its page", true);
    await click("More pages");
    await click("Customers", { within: '[aria-label="All pages"]' });
    await page.waitForFunction(() => location.pathname === "/customers");
    await ready();
    check("'More' opens every other page, then closes", (await h1()).includes("Customers") && !(await page.$('[aria-label="All pages"]')));
    const tapSizes = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Quick"] a, nav[aria-label="Quick"] button')].map((e) => Math.round(e.getBoundingClientRect().height)));
    check("Tab bar buttons are easy to tap (at least 44px tall)", tapSizes.every((x) => x >= 44), tapSizes.join(","));
    await page.evaluate(() => document.querySelector('[aria-label^="See "]').click());
    await wait(300);
    check("Tapping a customer opens their purchases as a bottom sheet", (await dialogOpen()) && (await text()).includes("Spent so far"));
    await page.keyboard.press("Escape");
    await go("/inventory");
    check("Stock shows easy-to-read cards instead of a wide table", (await page.$$eval('ul[aria-label="Products"] > li', (l) => l.filter((x) => x.offsetParent).length)) === 26 && (await page.evaluate(() => !document.querySelector("table.tbl")?.offsetParent)));
    const fontSize = await page.$eval('input[aria-label^="Search name"]', (e) => parseFloat(getComputedStyle(e).fontSize));
    check("Typing boxes use 16px text so iPhones don't zoom in", fontSize >= 16, `${fontSize}px`);
    await click("Add a product");
    const sheet = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"] > div').getBoundingClientRect();
      const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.innerText.trim() === "Add product").getBoundingClientRect();
      return { bottom: Math.round(d.bottom), btnBottom: Math.round(btn.bottom), btnH: Math.round(btn.height), vh: innerHeight };
    });
    check("Forms open as a bottom sheet with the Save button always on screen", sheet.bottom === sheet.vh && sheet.btnBottom <= sheet.vh && sheet.btnH >= 44, JSON.stringify(sheet));
    check("The page behind a sheet doesn't scroll", await page.evaluate(() => document.body.style.overflow === "hidden"));
    await page.keyboard.press("Escape");
    await wait(150);
    check("…and scrolling comes back when it closes", await page.evaluate(() => document.body.style.overflow !== "hidden"));
    await go("/pos");
    const sizeBtn = await page.evaluate(() => { const c = [...document.querySelectorAll("main .rounded-xl.border")].find((d) => d.innerText.includes("Polo")); const b = [...c.querySelectorAll("button")].find((x) => x.innerText.startsWith("M")); const r = b.getBoundingClientRect(); b.click(); return Math.round(Math.min(r.width, r.height)); });
    await wait(300);
    check("Size buttons are big enough to tap (44px+)", sizeBtn >= 44, `${sizeBtn}px`);
    check("A bill bar with the total stays at the bottom while picking", (await text()).includes("1 piece in the bill") && (await text()).includes("Review & pay"));
    await click("Review & pay");
    await wait(900);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(500);
    check("The bill bar gets out of the way once the Complete button is visible", !(await text()).includes("Review & pay"));
    await click("Cash", { exact: true, within: '[role="radiogroup"][aria-label="Paid by"]' });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Complete sale")).click());
    await page.waitForFunction(() => /\/sales\/.+/.test(location.pathname), { timeout: 5000 });
    await ready();
    check("A full sale works on a phone", (await text()).includes("Sale complete!") && (await state()).sales[0].paymentMethod === "Cash");
    await page.screenshot({ path: path.join(OUT, "phone-sale.png") });
    check("The bill reads well on a phone (items as a list, no wide table)", (await page.$('ul[aria-label="Items on this bill"]')) !== null && (await page.evaluate(() => document.documentElement.scrollWidth <= 391)));
    const a11yPhone = [];
    for (const p of ["/", "/pos", "/inventory", "/sales", "/purchases", "/customers"]) {
      await go(p);
      const v = await axe();
      if (v.length) a11yPhone.push(`${p}: ${v.join(", ")}`);
    }
    check("No accessibility problems in the phone layout", a11yPhone.length === 0, a11yPhone.join(" || "));

    S("23. Colour schemes");
    await page.setViewport({ width: 1440, height: 900 });
    await go("/settings");
    const schemes = await page.$$eval('[role="radiogroup"][aria-label="Colour scheme"] [role="radio"]', (r) => r.map((x) => x.innerText.split("\n")[0].trim()));
    check("Settings offers 5 colour schemes, Indigo is the default", schemes.length === 5 && (await page.evaluate(() => document.querySelector('[aria-label="Colour scheme"] [aria-checked="true"]').innerText.startsWith("Indigo"))) && (await page.evaluate(() => !document.documentElement.hasAttribute("data-theme"))), schemes.join(", "));
    const brandOf = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim());
    const indigoBrand = await brandOf();
    await click("Teal", { within: '[aria-label="Colour scheme"]' });
    check("Picking a scheme changes the colours straight away", (await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "teal" && (await brandOf()) !== indigoBrand && (await page.$eval('meta[name="theme-color"]', (m) => m.content)) === "#0f766e");
    await page.goto(BASE + "/reports", { waitUntil: "domcontentloaded" });
    const beforeReact = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await ready();
    check("The choice is remembered and applied before the page draws (no colour flash)", beforeReact === "teal");
    const themeA11y = [];
    for (const t of ["indigo", "terracotta", "teal", "maroon", "navy"]) {
      await page.evaluate((t) => localStorage.setItem("kapda-theme", t), t);
      for (const p of ["/", "/pos", "/inventory", "/settings"]) {
        await go(p);
        const v = await axe();
        if (v.length) themeA11y.push(`${t} ${p}: ${v.join(", ")}`);
      }
    }
    check("Every colour scheme is easy to read (no contrast or accessibility problems)", themeA11y.length === 0, themeA11y.join(" || "));
    await go("/settings");
    await click("Indigo", { within: '[aria-label="Colour scheme"]' });
    check("Switching back to the default clears the saved choice", (await page.evaluate(() => localStorage.getItem("kapda-theme"))) === null && !(await page.evaluate(() => document.documentElement.hasAttribute("data-theme"))));
  } catch (e) {
    check(`Test run crashed: ${e.message}`, false);
    await page.screenshot({ path: path.join(OUT, "crash.png") }).catch(() => {});
  }

  S("24. Browser errors");
  check("No JavaScript errors or failed requests anywhere", errors.length === 0, errors.slice(0, 5).join(" | "));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
