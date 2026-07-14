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

const cssUrls = [];
page.on("response", async (res) => {
  if (res.url().endsWith(".css")) cssUrls.push(res.url());
});
await page.goto("http://localhost:3000/fr/admin/orders/" + ORDER_ID + "/label", { waitUntil: "networkidle" });
console.log("CSS urls:", cssUrls);

for (const url of cssUrls) {
  const res = await page.request.get(url);
  const body = await res.text();
  if (body.includes("@page")) {
    console.log("FOUND @page in", url);
    const idx = body.indexOf("@page");
    console.log(body.slice(idx, idx + 200));
  }
}
await context.close();
await browser.close();
