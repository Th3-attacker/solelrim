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

const info = await page.evaluate(() => {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => ({
    href: l.getAttribute("href"), media: l.getAttribute("media"), disabled: l.disabled,
  }));
  const sheets = [...document.styleSheets].map(s => {
    let rules = [];
    try {
      rules = [...s.cssRules].map(r => r.cssText).filter(t => t.includes("@page"));
    } catch (e) { rules = ["ERROR: " + e.message]; }
    return { href: s.href, disabled: s.disabled, media: s.media.mediaText, pageRules: rules };
  });
  return { links, sheets };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
