import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("early cutoff preserves unpublished end-of-day targets as missing", async ({
  page,
}) => {
  await page.goto("/?date=2026-01-01&cutoff=00:00&view=accuracy");
  await expect(page.getByText("22 / 48", { exact: true })).toBeVisible();
  await page.getByText("Interval data and publications").click();
  const row = page.getByRole("row", { name: /^2026-01-02 22:00 / });
  await expect(row).toContainText("missing / valid");
  await expect(
    page.getByText("Earlier cutoffs can also lack later delivery targets.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("provenance timeout blocks assumed default, then retry loads server cutoff", async ({
  page,
}) => {
  await page.clock.install();
  const dayRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/day?")) dayRequests.push(request.url());
  });
  await page.route("**/api/provenance", () => {});
  await page.goto("/?date=2026-01-01");
  await page.clock.fastForward(21000);
  await expect(page.getByRole("alert").first()).toContainText(
    "Provenance request timed out",
  );
  expect(dayRequests).toEqual([]);
  await page.unroute("**/api/provenance");
  await page.route("**/api/provenance", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), defaultCutoff: "08:00" },
    });
  });
  await page.getByRole("button", { name: "Retry provenance" }).click();
  await expect(page.getByLabel("Decision cutoff")).toHaveValue("08:00");
  await expect(page.getByText("24 of 48", { exact: true })).toBeVisible();
  expect(dayRequests.length).toBeGreaterThan(0);
  expect(
    dayRequests.every((url) => url.includes("cutoff=08%3A00")),
  ).toBeTruthy();
});

test("real snapshot, cutoff changes, monthly accuracy, publication table and provenance", async ({
  page,
}) => {
  await page.goto("/?date=2026-01-01&cutoff=10:00");
  await expect(
    page.getByRole("heading", { name: "Next-day wind outlook" }),
  ).toBeVisible();
  await expect(page.getByText("24 of 48", { exact: true })).toBeVisible();
  await page.getByText("Interval data and publications").click();
  await expect(
    page.getByRole("cell", { name: "2026-01-01 09:30", exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Decision date").fill("2026-01-31");
  await page.getByLabel("Decision cutoff").fill("08:00");
  await page.getByRole("button", { name: "Apply settings" }).click();
  await expect(page).toHaveURL(/date=2026-01-31/);
  await expect(
    page.getByText("Sun, 1 Feb 2026", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Forecast accuracy" }).click();
  await page.getByLabel("Accuracy period").selectOption("month");
  await expect(page.getByText("744 / 1,488", { exact: true })).toBeVisible();
  await page.getByText("Data provenance and retrieval").click();
  await expect(page.getByText("Snapshot SHA-256")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "FUELHH documentation" }),
  ).toHaveAttribute("href", /elexon/);
});

test("API failure is explicit and retry recovers without invented results", async ({
  page,
}) => {
  await page.route("**/api/day?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Historical snapshot unavailable" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Historical snapshot unavailable",
  );
  await expect(page.getByText("24 of 48", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/day?**");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("24 of 48", { exact: true })).toBeVisible();
});

test("loading is announced and outdated responses cannot overwrite new settings", async ({
  page,
}) => {
  await page.route("**/api/day?**", async (route) => {
    if (route.request().url().includes("2026-01-01"))
      await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/?date=2026-01-01");
  await expect(page.getByRole("status")).toContainText("Loading");
  await page.getByLabel("Decision date").fill("2026-01-31");
  await page.getByRole("button", { name: "Apply settings" }).click();
  await expect(
    page.getByText("Sun, 1 Feb 2026", { exact: true }).first(),
  ).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(
    page.getByText("Sun, 1 Feb 2026", { exact: true }).first(),
  ).toBeVisible();
});

test("empty day explains missing data and metrics remain unavailable", async ({
  page,
}) => {
  await page.route("**/api/day?**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.intervals.forEach((r: Record<string, unknown>) =>
      Object.assign(r, {
        forecastMW: null,
        actualMW: null,
        errorMW: null,
        publishTime: null,
        actualPublishTime: null,
        forecastStatus: "missing",
        actualStatus: "missing",
      }),
    );
    Object.assign(body.summary, {
      matched: 0,
      unmatched: 48,
      coveragePercent: 0,
      maeMW: null,
      rmseMW: null,
      biasMW: null,
      missingForecast: 48,
      missingActual: 48,
      forecastAvailable: 0,
      actualAvailable: 0,
    });
    await route.fulfill({ json: body });
  });
  await page.goto("/?view=accuracy");
  await expect(page.getByText("No eligible forecast records")).toBeVisible();
  await expect(
    page.getByText(
      "No valid matched records are available for these settings.",
    ),
  ).toBeVisible();
});

test("keyboard, narrow layout, reduced motion and automated accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("24 of 48", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Forecast accuracy" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Forecast accuracy" }),
  ).toBeVisible();
  await expect(page.getByLabel("Accuracy period")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
