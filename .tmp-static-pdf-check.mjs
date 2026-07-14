import { chromium } from "playwright";
const OUT = "/tmp/claude-1000/-home-elhadj-Documents-Personnel-Project-solelrim/842060c8-525f-4754-8b27-bf2bea0d1e9f/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${OUT}/test-page-size.html`);
await page.pdf({ path: `${OUT}/test-static.pdf`, preferCSSPageSize: true });
await browser.close();
