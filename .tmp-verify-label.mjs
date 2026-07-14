import { chromium } from "playwright";

const OUT = "/tmp/claude-1000/-home-elhadj-Documents-Personnel-Project-solelrim/842060c8-525f-4754-8b27-bf2bea0d1e9f/scratchpad";
const ORDER_ID = "cmr92w4y30006j665i0qc91wf";
const EMAIL = "verify-tmp-solelrim@example.com";
const PASSWORD = "Verify-Tmp-9284!";

async function login(context) {
  const page = await context.newPage();
  await page.goto("http://localhost:3000/fr/admin/login", { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  return page;
}

const browser = await chromium.launch();

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await login(context);
  console.log("logged in, url:", page.url());

  await page.goto("http://localhost:3000/fr/admin/orders/" + ORDER_ID, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/label-01-order-detail.png`, fullPage: true });

  await page.goto("http://localhost:3000/fr/admin/orders/" + ORDER_ID + "/label", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/label-02-screen.png`, fullPage: true });

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: `${OUT}/label-03-print-media.png`, fullPage: true });

  await page.pdf({ path: `${OUT}/label-04.pdf` });

  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  const page = await login(context);
  await page.goto("http://localhost:3000/ar/admin/orders/" + ORDER_ID + "/label", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/label-05-dark-rtl.png`, fullPage: true });
  await context.close();
}

await browser.close();
console.log("done");
