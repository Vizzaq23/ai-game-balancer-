// Reproducible portfolio screenshots of the actual running app.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const destination = resolve("../assets");
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5000");
  await page
    .getByRole("heading", { name: "A fair fight starts here." })
    .waitFor();
  await page.screenshot({
    path: resolve(destination, "studio-welcome.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explore demo data" }).click();
  await page.getByRole("heading", { name: "Weapon breakdown" }).waitFor();
  await page.screenshot({
    path: resolve(destination, "studio-dashboard.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(destination, "studio-mobile.png"),
    fullPage: true,
  });
} finally {
  await browser.close();
}
