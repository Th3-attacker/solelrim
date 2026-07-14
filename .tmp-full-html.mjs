import { chromium } from "playwright";
const ORDER_ID = "cmr92w4y30006j665i0qc91wf";
const EMAIL = "verify-tmp-solelrim@example.com";
const PASSWORD = "Verify-Tmp-9284!";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000/fr/admin/login", { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin$/, { timeout: 10000 });
await page.goto("http://localhost:3000/fr/admin/orders/" + ORDER_ID + "/label", { waitUntil: "networkidle" });
const html = await page.content();
const matches = html.match(/[a-zA-Z0-9_%.\/\-\[\]\(\)]*\.css/g);
console.log("css refs:", matches);
console.log("mentions 'label':", (html.match(/label[^"']*/g) || []).slice(0, 20));
await browser.close();
