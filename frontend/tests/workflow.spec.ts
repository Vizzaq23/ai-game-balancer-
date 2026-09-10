import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("demo, filters, findings, explanations, exports and data search", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A fair fight starts here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore demo data" }).click();
  await expect(page.getByText("607 records loaded")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Weapon breakdown" }),
  ).toBeVisible();
  await expect(page.getByText("Potentially overpowered").first()).toBeVisible();
  await expect(
    page.getByText("Insufficient data", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Team filter").selectOption("Atlas");
  await expect(page.locator('.sr-only[role="status"]')).toContainText(
    "Analysis ready: 304 records",
  );
  await page.getByLabel("Weapon filter").selectOption("Longbow SR");
  await expect(
    page.getByText("Only one weapon is selected;", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator('.sr-only[role="status"]')).toContainText(
    "607 records",
  );
  await page.getByRole("button", { name: "Explain findings" }).click();
  await expect(
    page.getByText("BUILT-IN EXPLANATION", { exact: true }),
  ).toBeVisible();
  const reportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  const report = await reportPromise;
  expect(report.suggestedFilename()).toBe("game-balance-report.html");
  const html = await readFile((await report.path())!, "utf8");
  expect(html).toContain("Synthetic arena playtest");
  expect(html).toContain("Built-in explanation");
  expect(html).toContain("weapon = All; team = All");
  expect(html).toContain("not proof of weapon strength");
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const csvDownload = await csvPromise;
  expect(csvDownload.suggestedFilename()).toBe("balance-metrics.csv");
  const csv = await readFile((await csvDownload.path())!, "utf8");
  expect(csv).toContain("usage_share");
  expect(csv).toContain("Longbow SR");
  expect(csv.trim().split("\n")).toHaveLength(7);
  await page.getByRole("button", { name: "Match data", exact: true }).click();
  await page.getByLabel("Search match data").fill("Longbow");
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await expect(page.locator(".pagination")).toContainText("100 records");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".pagination")).toContainText("Page 2");
  await page.getByLabel("Search match data").fill("no-such-weapon");
  await expect(page.getByText("No records match your search.")).toBeVisible();
});

test("CSV upload, invalid data recovery, optional fields and zero deaths", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload match CSV")
    .setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("weapon,kills\nRifle,1"),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Missing required columns",
  );
  const csv = "weapon,kills,deaths\n" + "Rifle,5,0\n".repeat(20);
  await page
    .getByLabel("Upload match CSV")
    .setInputFiles({
      name: "playtest.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(page.getByText("playtest.csv", { exact: true })).toBeVisible();
  await expect(
    page.getByText("K/D unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No team data supplied" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByLabel("Upload match CSV")
    .setInputFiles({
      name: "invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("weapon,kills,deaths\nRifle,-1,2"),
    });
  await expect(page.getByRole("alert")).toContainText("non-negative integer");
  await expect(page.getByText("playtest.csv", { exact: true })).toBeVisible();
});

test("API failure is actionable and retry works", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/v1/demo", (route) => route.abort());
  await page.getByRole("button", { name: "Explore demo data" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to reach");
  await page.unroute("**/api/v1/demo");
  await page.getByRole("button", { name: "Explore demo data" }).click();
  await expect(page.getByText("607 records loaded")).toBeVisible();
});

test("keyboard methodology dialog, tolerance and accessibility", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Methodology & limitations" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Explore demo data" }).click();
  await expect(page.getByText("607 records loaded")).toBeVisible();
  const tolerance = page.getByLabel("Balance tolerance");
  await tolerance.focus();
  await page.keyboard.press("End");
  await expect(page.locator('.sr-only[role="status"]')).toContainText(
    "0 potential imbalance signals",
  );
  await expect(tolerance).toHaveValue("5");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("report escapes labels and CSV neutralizes spreadsheet formulas", async ({
  page,
}) => {
  await page.goto("/");
  const csv =
    'weapon,kills,deaths\n"=2+3",2,1\n"<img src=x onerror=alert(1)>",1,2\n';
  await page
    .getByLabel("Upload match CSV")
    .setInputFiles({
      name: "escaping.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(page.getByText("escaping.csv", { exact: true })).toBeVisible();
  const reportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  const html = await readFile((await (await reportPromise).path())!, "utf8");
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(html).not.toContain("<img src=x");
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const exported = await readFile((await (await csvPromise).path())!, "utf8");
  expect(exported).toContain('"\'=2+3"');
});
