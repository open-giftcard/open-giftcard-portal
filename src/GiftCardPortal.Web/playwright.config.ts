import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // The finance and reconciliation journey is long by design - summary, timeline
  // paging, filtered search, issuance, lifecycle, distribution, team
  // administration, role assignment, reconciliation, and audit in one signed-in
  // session. On an idle machine it takes ~54s in Firefox, which left only six
  // seconds of a 60s budget; one competing build was enough to fail it at the
  // role-assignment step while Chromium passed the identical assertions. The
  // budget was the defect, not the journey, so it is set well clear of the
  // observed worst case rather than papered over with retries.
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PORTAL_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
