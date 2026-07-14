import { chromium } from "playwright";
const OUT = "/tmp/claude-1000/-home-elhadj-Documents-Personnel-Project-solelrim/842060c8-525f-4754-8b27-bf2bea0d1e9f/scratchpad";
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
await page.pdf({ path: `${OUT}/label-08-prod.pdf`, preferCSSPageSize: true });
await browser.close();
console.log("done");
