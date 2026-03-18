import { spinTestEnvironment, execCommand, execCommandDetached, enforceTimeout } from "../sandbox/dockerManager.js";
import runPlaywrightTests from "../testing/playwrightTests.js";

/**
 * Runs the full evaluation pipeline:
 * 1. Spin up an isolated Docker container (port 3000 mapped to a free host port)
 * 2. npm install → npm run build → serve the built app
 * 3. Run Playwright UI tests on the host against the mapped port
 * 4. Return structured test results + full execution logs
 *
 * @param {string} projectPath - Absolute path to the extracted React project
 * @returns {Object} { components, props, state, routing, api, logs }
 */
export default async function runTests(projectPath) {

  // Spin up sandbox — container port 3000 is bound to a dynamic host port
  const { container, hostPort } = await spinTestEnvironment(projectPath);

  // Auto-kill after 2 minutes to prevent runaway containers
  enforceTimeout(container, 120000);

  const executionLogs = [];

  try {
    // ── Step 1: Install dependencies ──────────────────────────────────────
    console.log("Installing dependencies inside sandbox...");
    try {
      const installLogs = await execCommand(container, "npm install --prefer-offline --ignore-scripts 2>&1");
      executionLogs.push("=== npm install ===\n" + installLogs);
    } catch (err) {
      executionLogs.push(`=== npm install FAILED ===\n${err.message}`);
      return createFailResult(executionLogs, "Dependency installation failed. Check package.json.");
    }

    // ── Step 2: Build the React project ───────────────────────────────────
    console.log("Building React project...");
    let buildLogs;
    try {
      buildLogs = await execCommand(container, "npm run build 2>&1");
      executionLogs.push("=== npm run build ===\n" + buildLogs);
      
      // If build outputs obvious error strings, treat as failure
      if (buildLogs.toLowerCase().includes("err!") || buildLogs.includes("Command failed")) {
        return createFailResult(executionLogs, "Build failed. Check syntax and compilation errors.");
      }
    } catch (err) {
      executionLogs.push(`=== npm run build FAILED ===\n${err.message}`);
      return createFailResult(executionLogs, "Build script failed to execute. Check syntax and compilation errors.");
    }

    // Detect build output folder (Vite → /dist, CRA → /build)
    const buildFolder = await detectBuildFolder(container);
    executionLogs.push(`=== Build folder detected: ${buildFolder} ===`);

    // ── Step 3: Serve built app on container port 3000 ────────────────────
    console.log(`Serving app from /${buildFolder} on container port 3000...`);
    await execCommandDetached(
      container,
      `python3 -m http.server 3000 --directory ${buildFolder}`
    );
    
    // Give the server a moment to start before running Playwright
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // ── Step 4: Run Playwright tests on the host using the mapped port ────
    console.log(`Running Playwright tests against http://localhost:${hostPort} ...`);
    const { results, logs: playwrightLogs } = await runPlaywrightTests(hostPort);
    executionLogs.push("=== Playwright Tests ===\n" + playwrightLogs.join("\n"));

    return {
      ...results,   // { components, props, state, routing, api }
      logs: executionLogs.join("\n\n"),
    };

  } catch (error) {
    // Top-level sandbox failure (e.g. docker crashed)
    executionLogs.push(`=== Sandbox Error ===\n${error.message}`);
    return createFailResult(executionLogs, `Fatal execution error: ${error.message}`);
  } finally {
    // Always stop the container — AutoRemove:true will clean it up
    try { await container.stop(); } catch { /* already stopped */ }
  }
}

/**
 * Returns a 0-score test result object when the build or install step fails gracefully.
 */
function createFailResult(executionLogs, failMessage) {
  executionLogs.push(`\n[FATAL] ${failMessage}`);
  return {
    components: false,
    props: false,
    state: false,
    routing: false,
    api: false,
    logs: executionLogs.join("\n\n"),
  };
}

/**
 * Detects whether the project built to /dist (Vite) or /build (CRA).
 * Falls back to "dist" if neither is found.
 *
 * @param {object} container - Dockerode container instance
 * @returns {Promise<string>} - "dist" | "build"
 */
async function detectBuildFolder(container) {
  const check = await execCommand(
    container,
    "[ -d dist ] && echo dist || ([ -d build ] && echo build || echo dist)"
  );
  return check.trim();
}