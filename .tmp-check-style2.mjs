import { chromium } from "playwright";
const ORDER_ID = "cmr92w4y30006j665i0qc91wf";
const EMAIL = "verify-tmp-solelrim@example.com";
const PASSWORD = "Verify-Tmp-9284!";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto("http://localhost:3000/fr/admin/login", { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin$/, { timeout: 10000 });
await page.goto("http://localhost:3000/fr/admin/orders/" + ORDER_ID + "/label", { waitUntil: "networkidle" });
const html = await page.content();
console.log("has 10cm:", html.includes("10cm"));
console.log("has 15cm:", html.includes("15cm"));
const styleTags = await page.locator("style").count();
console.log("style tag count:", styleTags);
for (let i = 0; i < styleTags; i++) {
  const txt = await page.locator("style").nth(i).innerHTML();
  if (txt.includes("page")) console.log("STYLE", i, ":", txt.slice(0, 200));
}
await context.close();
await browser.close();
