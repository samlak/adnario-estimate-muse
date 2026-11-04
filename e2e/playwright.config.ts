/** The end-to-end test (flow.spec.ts) against the app at E2E_URL (default http://localhost:3000). If nothing answers
 * there it starts the app with `npm run dev`. Results go to e2e/results and e2e/report, never into git. */
import { defineConfig } from '@playwright/test';

const url = process.env.E2E_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: '.',
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  outputDir: 'results',
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL: url,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // the Chrome already installed, if asked (E2E_CHANNEL=chrome); else Playwright's own Chromium
    channel: process.env.E2E_CHANNEL || undefined,
    // a software GPU, so the 3D viewer has WebGL in a headless browser
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npm run dev', cwd: '..', url: `${url}/api/v1/health`, reuseExistingServer: true, timeout: 5 * 60_000 },
});
