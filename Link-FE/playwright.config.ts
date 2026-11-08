import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "on-failure" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // page.request.* calls bypass apiClient, so give them a fixed double-submit token.
    // csrf.spec.ts clears both to test the real browser flow.
    extraHTTPHeaders: { "X-XSRF-TOKEN": "e2e-csrf-token" },
    storageState: {
      cookies: [{
        name: "XSRF-TOKEN", value: "e2e-csrf-token", domain: "localhost", path: "/",
        expires: -1, httpOnly: false, secure: false, sameSite: "Lax",
      }],
      origins: [],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
