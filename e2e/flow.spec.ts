/** The whole process, end to end, in a real browser against the running app (README §7): sign in, a new project
 * with its IFC model, the takeoff run, Generate BOQ, Link to cost, an edit with undo, the exports, the programme,
 * the cash flow, Adnario AI, and who may see what. The AI steps call Muse, so a run takes a few minutes.
 * The sample used is Ikoyi Duplex (overview/samples). The project it makes is deleted at the end. */
import { expect, test, type Browser, type Page } from '@playwright/test';
import path from 'node:path';

const SAMPLES = path.resolve(__dirname, '../overview/samples/ikoyi-duplex');
const PASSWORD = 'demo-password';
const NAME = `E2E Duplex ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
const AI = 5 * 60_000; // an AI step: the slowest answers take a few minutes

test.describe.configure({ mode: 'serial' });

let page: Page;
let projectId = '';
const errors: string[] = []; // the browser's own errors: any one fails the run

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const signed = await context.newPage();
  await signed.goto('/signin');
  await signed.locator('input[type=email]').fill(email);
  await signed.locator('input[type=password]').fill(PASSWORD);
  await signed.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(signed.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  return signed;
}

const shot = async (name: string) => {
  const file = test.info().outputPath(`${name}.png`); // e2e/results/<test>/<name>.png, and in the report
  await page.screenshot({ path: file });
  await test.info().attach(name, { path: file, contentType: 'image/png' });
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(() => {
  expect(errors, 'errors in the browser').toEqual([]);
});

test('sign in: a wrong password is refused, the right one lets the QS in', async () => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: /Demo accounts/ }).click();
  await expect(page.getByText('Tunde Bello')).toBeVisible();
  await page.getByRole('button', { name: /Demo accounts/ }).click();
  await page.locator('input[type=email]').fill('qs@demo.adnario.app');
  await page.locator('input[type=password]').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('That email and password do not match.')).toBeVisible();
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/Good (morning|afternoon|evening), Tunde/)).toBeVisible();
  await expect(page.getByText('Lekki Office Block').first()).toBeVisible();
});

test('a new project with its IFC model, converted for the viewer', async () => {
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByPlaceholder('Office block, Lekki').fill(NAME);
  await page.getByPlaceholder('Lekki, Lagos').fill('Ikoyi, Lagos');
  await page.locator('input[type=file][accept=".ifc"]').setInputFiles(path.join(SAMPLES, 'Ifc2x3_Duplex_Architecture.ifc'));
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  projectId = page.url().split('/').pop()!;
  // a project opens on its takeoff
  await expect(page.getByText('READY FOR TAKEOFF')).toBeVisible();
  await expect(page.locator('button[title="Takeoff"]')).toHaveClass(/bg-primary-50/);
  // converted on the server (IFC → XKT); the Models panel says how long it took
  await page.locator('button[title="Models"]').click();
  await expect(page.getByText('Ifc2x3_Duplex_Architecture.ifc', { exact: true })).toBeVisible();
  await expect(page.getByText(/v1 · [\d.]+ MB · [\d.]+s/)).toBeVisible({ timeout: 3 * 60_000 });
  // nothing to annotate before a takeoff: Original is on, Annotated waits
  await expect(page.locator('button[title^="Original"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button[title^="Annotated"]')).toBeDisabled();
  // the money panels say what they wait for
  for (const panel of ['Cost', 'Cash flow']) {
    await page.locator(`button[title="${panel}"]`).click();
    await expect(page.getByText('No BOQ yet', { exact: true })).toBeVisible();
  }
  await page.locator('button[title="Models"]').click();
  await shot('model');
});

test('takeoff: the run measures the model and the AI maps every type, live on the model', async () => {
  await page.locator('button[title="Takeoff"]').click();
  await page.getByPlaceholder(/^Location, use, specification/).fill('Two-storey residential duplex in Ikoyi, Lagos. Sandcrete block walls, reinforced concrete frame.');
  await page.getByRole('button', { name: 'Start takeoff' }).click();
  // while it runs: the steps, what the AI sees, each type as it is decided, numbered on the model
  await expect(page.getByText('ESTIMATING')).toBeVisible();
  await expect(page.locator('button[title^="Annotated"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/\d+ elements → \d+ distinct types/)).toBeVisible({ timeout: AI });
  await expect(page.getByText('What the AI sees in this model').locator('..').locator('li').first()).toBeVisible({ timeout: AI });
  await expect(page.locator('.marks .mk.number').first()).toBeVisible({ timeout: AI });
  await shot('running');
  await expect(page.getByText(/TAKEOFF 1 · READY IN/)).toBeVisible({ timeout: AI });
  await expect(page.getByRole('button', { name: /^Takeoff \d+/ })).toBeVisible();
  const lines = await page.locator('tbody tr').count();
  expect(lines).toBeGreaterThan(10);
  // the takeoff on the model: a dot per line; Original and Skeleton have none
  await expect(page.locator('.marks .mk.dot, .marks .mk.cluster').first()).toBeVisible();
  await page.locator('button[title^="Skeleton"]').click();
  await expect(page.locator('.marks .mk.dot, .marks .mk.cluster')).toHaveCount(0);
  await page.locator('button[title^="Original"]').click();
  await expect(page.locator('.marks .mk.dot, .marks .mk.cluster')).toHaveCount(0);
  await page.locator('button[title^="Annotated"]').click();
  await expect(page.locator('.marks .mk.dot, .marks .mk.cluster').first()).toBeVisible();
  // what was left out can be added back
  await page.getByRole('button', { name: /^Not measured/ }).click();
  await expect(page.getByRole('button', { name: 'Add to takeoff' }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Measured/ }).click();
  await shot('takeoff');
});

test('Generate BOQ: the lines become the bill, coded B1A…', async () => {
  await page.getByRole('button', { name: /^BOQ/ }).click();
  await expect(page.getByRole('heading', { name: 'No BOQ yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate BOQ' }).last().click();
  await expect(page.getByRole('heading', { name: 'Generating the BOQ…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate again' })).toBeVisible({ timeout: AI });
  await expect(page.getByRole('cell', { name: 'B1A', exact: true })).toBeVisible();
  // a line opens its label on the model and selects its elements
  await page.getByRole('cell', { name: 'B1A', exact: true }).click();
  await expect(page.locator('.marks .mk.open .mk-label')).toContainText('B1A');
  await expect(page.getByText('Properties', { exact: true })).toBeVisible();
  // the page never moves: the card floats over the viewer
  expect(await page.evaluate(() => [window.scrollX, document.scrollingElement!.scrollLeft])).toEqual([0, 0]);
  await shot('boq');
});

test('Link to cost: rates come from the rate card', async () => {
  await page.locator('button[title="Cost"]').click();
  await page.getByRole('button', { name: 'Link to cost', exact: true }).click();
  await expect(page.getByText(/Pick and check the card item for each line/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Link to cost again' })).toBeVisible({ timeout: AI });
  const priced = await page.getByText(/(\d+) of (\d+) lines priced/).textContent();
  const [, done, of] = priced!.match(/(\d+) of (\d+)/)!.map(Number);
  expect(done).toBeGreaterThan(of / 2);
  await expect(page.getByRole('heading', { name: /^₦[\d,]+$/ })).toBeVisible();
  await shot('cost');
});

test('an edit is one step of undo and redo', async () => {
  await page.locator('button[title="Takeoff"]').click();
  await page.getByRole('button', { name: /^Provisional/ }).click();
  const before = await page.getByRole('button', { name: /^BOQ/ }).textContent();
  await page.getByRole('button', { name: 'Add to BOQ' }).first().click();
  await expect(page.getByRole('button', { name: 'Added' }).first()).toBeVisible();
  expect(await page.getByRole('button', { name: /^BOQ/ }).textContent()).not.toBe(before);
  await page.locator('button[title="Undo"]').click();
  await expect(page.getByRole('button', { name: /^BOQ/ })).toHaveText(before!);
  await page.locator('button[title="Redo"]').click();
  await expect(page.getByRole('button', { name: 'Added' }).first()).toBeVisible();
});

test('exports: the BOQ as Excel and PDF', async () => {
  const estimate = await (await page.request.get(`/api/v1/projects/${projectId}/estimate`)).json();
  for (const [kind, type] of [['boq.xlsx', 'spreadsheetml'], ['boq.pdf', 'application/pdf']]) {
    const answer = await page.request.get(`/api/v1/estimates/${estimate.id}/export/${kind}`);
    expect(answer.status(), kind).toBe(200);
    expect(answer.headers()['content-type']).toContain(type);
    expect((await answer.body()).length).toBeGreaterThan(2000);
  }
});

test('programme: the PDF is read, put on the calendar and linked to the BOQ', async () => {
  await page.locator('button[title="Programme"]').click();
  await expect(page.getByRole('heading', { name: 'No programme yet' })).toBeVisible();
  await page.locator('input[type=file][accept="application/pdf"]').setInputFiles(path.join(SAMPLES, 'Ikoyi_Duplex_Programme.pdf'));
  await expect(page.getByText('Put the BOQ work under its activities')).toBeVisible();
  await expect(page.getByRole('heading', { name: '146 working days' })).toBeVisible({ timeout: AI });
  await expect(page.getByText('1 Feb 2027 → 24 Jul 2027')).toBeVisible();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await expect(page.getByText('Day 146 of 146').first()).toBeVisible();
  await shot('programme');
});

test('cash flow: the money by month, and its Excel', async () => {
  await page.locator('button[title="Cash flow"]').click();
  await expect(page.getByText('CASH FLOW')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^₦[\d,]+$/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Feb 2027' })).toBeVisible();
  const estimate = await (await page.request.get(`/api/v1/projects/${projectId}/estimate`)).json();
  expect((await page.request.get(`/api/v1/estimates/${estimate.id}/export/cashflow.xlsx`)).status()).toBe(200);
  await shot('cashflow');
});

test('comments: on the project, and on an element picked in 3D', async () => {
  await page.locator('button[title="Takeoff"]').click();
  await page.locator('button[title="Conversation"]').click();
  await expect(page.getByRole('heading', { name: 'Conversation' })).toBeVisible();
  await page.getByPlaceholder('Write a message...').fill('E2E: please check the external walls.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('E2E: please check the external walls.')).toBeVisible();
  await page.getByRole('dialog', { name: 'Conversation' }).locator('button[title="Close"]').click();
  // an element clicked on the model opens in Properties, where it gets a comment and a pin on the model
  await page.locator('button[title^="Original"]').click();
  const canvas = (await page.locator('#canvas').boundingBox())!;
  for (const [x, y] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.5, 0.6], [0.4, 0.5], [0.6, 0.5]]) {
    await page.mouse.click(canvas.x + canvas.width * x, canvas.y + canvas.height * y);
    await page.waitForTimeout(800); // a second click sooner would be a double-click, which the model takes as fly-to
    if (await page.getByText('Properties', { exact: true }).isVisible()) break;
  }
  await expect(page.getByText('Properties', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await page.getByPlaceholder('A comment on this element…').fill('E2E: confirm this membrane gauge.');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.locator('.marks .mk.pin').first()).toBeVisible();
  await page.locator('button[title^="Annotated"]').click();
});

test('the model zooms, never the page', async () => {
  const canvas = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -400);
  await page.keyboard.up('Control');
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});

test('Adnario AI answers from the estimate', async () => {
  await page.getByRole('button', { name: 'Adnario AI' }).click();
  const question = page.getByLabel('Your question');
  await question.fill('What is the BOQ total?');
  await question.press('Enter');
  await expect(page.locator('.said.assistant').last()).toContainText('₦', { timeout: AI });
  await expect(page.locator('button[title="Ask (Enter)"]')).toBeVisible({ timeout: AI });
  await shot('adnario-ai');
});

test('who sees what: roles and firms', async ({ browser }) => {
  const contributor = await signIn(browser, 'architect@demo.adnario.app');
  await expect(contributor.getByRole('link', { name: 'Rate cards' })).toHaveCount(0);
  expect((await contributor.request.get('/api/v1/ratecards')).status()).toBe(403);
  const viewer = await signIn(browser, 'client@demo.adnario.app');
  await expect(viewer.getByRole('button', { name: 'New project' })).toHaveCount(0);
  // the project is the QS's alone: neither is on it
  expect((await viewer.request.get(`/api/v1/projects/${projectId}`)).status()).toBe(404);
  // another firm never sees this one's data
  const other = await signIn(browser, 'admin@northbridge.adnario.app');
  expect((await other.request.get(`/api/v1/projects/${projectId}`)).status()).toBe(404);
  const theirs = await (await other.request.get('/api/v1/projects')).json();
  expect(theirs.map((each: { name: string }) => each.name)).not.toContain('Lekki Office Block');
});

test.afterAll(async ({ browser }) => {
  if (!projectId || process.env.E2E_KEEP) return;
  const admin = await signIn(browser, 'admin@demo.adnario.app');
  expect((await admin.request.delete(`/api/v1/projects/${projectId}`)).status()).toBe(200);
});
