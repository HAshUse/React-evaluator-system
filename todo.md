# React Evaluator — To-Do List

> **Overall Completion: ~42%** | Remaining: ~58%

---

## 🔴 Priority 1 — Critical (Core Evaluator Logic)

- [ ] **[src/testing/playwrightTests.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/playwrightTests.js)** — Rewrite from scratch
  - Remove broken imports (`Component` from React, `fa` from Zod — both invalid)
  - Write real Playwright test cases for each rubric criteria:
    - [ ] Component rendering (check DOM elements exist)
    - [ ] Props handling (verify props passed between components)
    - [ ] State updates (simulate clicks/input, verify UI changes)
    - [ ] Routing (navigate between pages, check URL/content changes)
    - [ ] API integration (mock API, verify app handles response)
  - Return structured result object `{ components, props, state, routing, api }`

- [ ] **[src/evaluator/runner.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/runner.js)** — Replace hardcoded results
  - Currently returns `{ components: true, state: true, routing: false, ... }` — hardcoded!
  - Wire it to actually call [playwrightTests.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/playwrightTests.js) after the build step
  - Parse real test output and return actual pass/fail per criteria

- [ ] **[src/testing/apiMock.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/apiMock.js)** — Implement API mocking (empty file)
  - Use Playwright's `page.route()` to intercept and mock API calls
  - Return controlled mock responses so API tests are reliable

---

## 🟠 Priority 2 — Important (Supporting Features)

- [ ] **[src/ai/feedback.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/ai/feedback.js)** — Implement AI feedback generation (empty file)
  - Integrate OpenAI Node SDK (install: `npm install openai`)
  - Accept test failure details as input
  - Return constructive feedback text
  - ⚠️ AI must NOT override the calculated score — only generate text

- [ ] **[src/utils/logger.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/utils/logger.js)** — Build structured logger (empty file)
  - Wrap Fastify's built-in `pino` logger or create a simple custom one
  - Export `log.info()`, `log.error()`, `log.warn()` helpers
  - Plug logger into [evaluator/index.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/index.js) and [runner.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/runner.js)

- [ ] **[src/utils/timeout.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/utils/timeout.js)** — Extract timeout logic (empty file)
  - Move the inline [enforceTimeout](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/sandbox/dockerManager.js#58-67) from [dockerManager.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/sandbox/dockerManager.js) into this util
  - Make it a reusable, configurable helper

- [ ] **[src/routes/evaluateRoute.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/routes/evaluateRoute.js)** — Add input validation
  - Use `zod` (already installed) to validate incoming request body
  - Validate: `assignment_id`, `student_id`, `submission_zip_path`, `rubric_json`
  - Return a clear `400` error if validation fails

---

## 🟡 Priority 3 — Nice to Have / PRD Optional Features

- [ ] **[src/evaluator/scorer.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/scorer.js)** — Improve output quality
  - `feedback` is currently a static string — make it dynamic based on results
  - Populate `warnings` (e.g., "Routing failed", "API test skipped")
  - Populate `execution_logs` with actual build/test logs from Docker

- [ ] **Sandbox hardening** in [src/sandbox/dockerManager.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/sandbox/dockerManager.js)
  - Add `ReadonlyRootfs: true` to prevent disk writes inside the container
  - Consider limiting `PidsLimit` to prevent fork bombs

- [ ] **Job Queue integration** — For 500+ student batch processing
  - Integrate Bull, RabbitMQ, or AWS SQS
  - Wrap each evaluation in a queue job with retry logic
  - *(Note: marked out-of-scope in your [implementation_plan.md](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/implementation_plan.md) — confirm with teacher)*

- [ ] **Results export**
  - CSV export of scores + rubric breakdown per student
  - PDF report generation (optional)

- [ ] **AI plagiarism detection** (PRD Section 9)
  - Compare student submissions for similarity
  - Flag suspicious matches with a warning in output

---

## 🐛 Known Bugs to Fix

| File | Bug |
|------|-----|
| [playwrightTests.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/playwrightTests.js) | `import { Component } from "react"` — React not installed in evaluator |
| [playwrightTests.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/playwrightTests.js) | `import { fa } from "zod/locales"` — invalid import, this doesn't exist |
| [runner.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/runner.js) | Test results are hardcoded, not real |
| [scorer.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/scorer.js) | `testResults[name]` does a key lookup but rubric criteria names don't match runner output keys (case mismatch: `"Components render correctly"` vs `components`) |

---

## 📁 File Status Summary

| File | Status |
|------|--------|
| [server.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/server.js) | ✅ Done |
| [modules/evaluateModule.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/modules/evaluateModule.js) | ✅ Done |
| [routes/evaluateRoute.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/routes/evaluateRoute.js) | ⚠️ Needs Zod validation |
| [evaluator/index.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/index.js) | ✅ Done |
| [evaluator/extract.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/extract.js) | ✅ Done |
| [evaluator/runner.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/runner.js) | ⚠️ Hardcoded — needs real tests |
| [evaluator/scorer.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/evaluator/scorer.js) | ⚠️ Works but output is shallow |
| [sandbox/dockerManager.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/sandbox/dockerManager.js) | ⚠️ ~80% — needs disk write restriction |
| [testing/playwrightTests.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/playwrightTests.js) | ❌ Broken — rewrite needed |
| [testing/apiMock.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/testing/apiMock.js) | ❌ Empty |
| [ai/feedback.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/ai/feedback.js) | ❌ Empty |
| [utils/logger.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/utils/logger.js) | ❌ Empty |
| [utils/timeout.js](file:///c:/Users/bhask/OneDrive/Documents/Ed-tech/react-evaluator/src/utils/timeout.js) | ❌ Empty |
