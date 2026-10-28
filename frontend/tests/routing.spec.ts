import { expect, test } from "@playwright/test";

test.describe("Vercel routing contract", () => {
  test.skip(
    !process.env.VERCEL_ROUTING_CHECK,
    "Enable for the Vercel routing harness or public deployment",
  );

  test("direct accuracy URL and extensionless page refresh keep UI and same-origin API working", async ({
    page,
  }) => {
    await page.goto(
      "/review?view=accuracy&period=month&date=2026-01-31&cutoff=10:00",
    );
    await expect(
      page.getByRole("heading", { name: "Forecast accuracy", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("744 / 1,488", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("744 / 1,488", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Decision forecast", exact: true })
      .click();
    await expect(page.getByText("24 of 48", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Sun, 1 Feb 2026", { exact: true }).first(),
    ).toBeVisible();
  });

  test("API errors and backend data paths are not swallowed by the SPA fallback", async ({
    request,
  }) => {
    const api = await request.get("/api/not-real");
    expect(api.status()).toBe(404);
    expect(api.headers()["content-type"]).toContain("application/json");
    expect((await request.get("/data/snapshot.json.gz")).status()).toBe(404);
    expect((await request.get("/assets/not-real.js")).status()).toBe(404);
  });

  test("public provenance and default metrics come from the bundled snapshot", async ({
    request,
  }) => {
    const health = await (await request.get("/api/health")).json();
    expect(health.snapshotSha256).toBe(
      "1a79b61208823de9de417987d7caf563a1791df9faf23b9176341607b7b8650a",
    );
    const provenance = await (await request.get("/api/provenance")).json();
    expect(provenance.records).toEqual({ forecasts: 19856, actuals: 1488 });
    const { summary } = await (
      await request.get("/api/accuracy?cutoff=10:00")
    ).json();
    expect(summary.matched).toBe(744);
    expect(summary.maeMW).toBeCloseTo(1995.57, 2);
    expect(summary.rmseMW).toBeCloseTo(2498.82, 2);
    expect(summary.biasMW).toBeCloseTo(1727.98, 2);
  });
});
