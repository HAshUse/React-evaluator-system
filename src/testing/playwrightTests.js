import { chromium } from "playwright";
import { setupApiMocks, getMockSignals } from "./apiMock.js";

/**
 * Runs all Playwright-based UI tests against the student's React app.
 * The app runs inside Docker and is exposed on a dynamic host port.
 *
 * @param {number} hostPort - The host port mapped from container port 3000
 * @returns {{ results, logs }} - pass/fail per rubric criteria + log lines
 */
export default async function runPlaywrightTests(hostPort = 3000) {
  const APP_URL = `http://127.0.0.1:${hostPort}`;

  const browser = await chromium.launch({ headless: true });

  const results = {
    components: false,
    props: false,
    state: false,
    routing: false,
    api: false,
  };

  const logs = [];

  try {
    const page = await browser.newPage();

    // Set up pattern-matched API mocks BEFORE first navigation
    const interceptedUrls = await setupApiMocks(page);

    // Initial load
    logs.push("Navigating to app...");
    await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 15000 });

    // ─── Test 1: Component Rendering ────────────────────────────────────────
    try {
      const rootHasContent = await page.evaluate(() => {
        const root = document.getElementById("root") || document.getElementById("app");
        return root ? root.children.length > 0 : document.body.children.length > 0;
      });

      const bodyText = await page.textContent("body");
      const hasVisibleText = bodyText.trim().length > 10;

      results.components = rootHasContent && hasVisibleText;
      logs.push(`[components] rootHasContent=${rootHasContent}, hasVisibleText=${hasVisibleText}`);
    } catch (err) {
      logs.push(`[components] FAILED — ${err.message}`);
    }

    // ─── Test 2: Props Handling ──────────────────────────────────────────────
    try {
      const hasPropDrivenContent = await page.evaluate(() => {
        const lists = document.querySelectorAll("ul li, ol li, [class*='card'], [class*='item'], [class*='list']");
        return lists.length > 0;
      });

      results.props = hasPropDrivenContent;
      logs.push(`[props] hasPropDrivenContent=${hasPropDrivenContent}`);
    } catch (err) {
      logs.push(`[props] FAILED — ${err.message}`);
    }

    // ─── Test 5: API Integration (Check DOM after initial load) ──────────────
    try {
      logs.push(`[api] Intercepted ${interceptedUrls.length} request(s): ${interceptedUrls.join(", ") || "none"}`);
      await page.waitForTimeout(500); // UI settles after fetch

      const bodyContent = await page.textContent("body");
      const mockSignals = getMockSignals();
      const apiDataRendered = mockSignals.some((signal) => bodyContent.includes(signal));

      results.api = apiDataRendered;
      logs.push(`[api] Mocked data rendered in DOM: ${apiDataRendered}`);
    } catch (err) {
      logs.push(`[api] FAILED — ${err.message}`);
    }

    // ─── Test 4: Routing ─────────────────────────────────────────────────────
    try {
      const initialUrl = page.url();
      const initialContent = await page.textContent("body");

      const navLink = await page.$("nav a, [role='navigation'] a, a[href^='/'], a[href^='#']");

      if (navLink) {
        await navLink.click();
        await page.waitForTimeout(800);

        const newUrl = page.url();
        const newContent = await page.textContent("body");

        const urlChanged = initialUrl !== newUrl;
        const contentChanged = initialContent !== newContent;
        results.routing = urlChanged || contentChanged;
        logs.push(`[routing] urlChanged=${urlChanged}, contentChanged=${contentChanged}`);
      } else {
        logs.push("[routing] No navigation links found");
      }
    } catch (err) {
      logs.push(`[routing] FAILED — ${err.message}`);
    }

    // ─── Test 3: State Updates (Do this last as it Mutates UI) ───────────────
    try {
      const domBefore = await page.evaluate(() => document.body.innerHTML);

      const interactiveSelector = "button, input[type='checkbox'], input[type='radio'], [role='button'], [role='switch']";
      const interactiveEl = await page.$(interactiveSelector);

      if (interactiveEl) {
        await interactiveEl.click();
        await page.waitForTimeout(500);
        const domAfter = await page.evaluate(() => document.body.innerHTML);
        results.state = domBefore !== domAfter;
        logs.push(`[state] DOM changed after click: ${domBefore !== domAfter}`);
      } else {
        const inputEl = await page.$("input[type='text'], input[type='search'], textarea");
        if (inputEl) {
          const domBeforeInput = await page.evaluate(() => document.body.innerHTML);
          await inputEl.type("test");
          await page.waitForTimeout(500);
          const domAfterInput = await page.evaluate(() => document.body.innerHTML);
          results.state = domBeforeInput !== domAfterInput;
          logs.push(`[state] DOM changed after typing: ${domBeforeInput !== domAfterInput}`);
        } else {
          logs.push("[state] No interactive elements found to trigger state");
        }
      }
    } catch (err) {
      logs.push(`[state] FAILED — ${err.message}`);
    }

    await page.close();
  } finally {
    await browser.close();
  }

  return { results, logs };
}