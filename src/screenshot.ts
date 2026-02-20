/**
 * screenshot.ts
 *
 * Takes a screenshot of demo.html using Playwright.
 * Run with: bun run src/screenshot.ts
 */
import { chromium } from "playwright";
import { resolve } from "path";

const htmlFile = resolve("demo.html");
const outFile = "demo-screenshot.png";

const CHROMIUM_PATH = `${process.env.HOME}/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`;

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROMIUM_PATH,
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`file://${htmlFile}`);
// Wait for SVG rendering
await page.waitForTimeout(500);
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();

console.log(`Screenshot saved to ${outFile}`);
