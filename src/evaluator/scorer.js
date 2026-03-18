import { generateAIFeedback } from "../ai/feedback.js";
import logger from "../utils/logger.js";

/**
 * Maps rubric criteria names to testResults keys from playwrightTests.js.
 * This allows teachers to use human-readable names in rubric JSON (e.g.
 * "Components render correctly") while internally matching to result keys
 * like "components".
 */
const CRITERIA_KEY_MAP = {
  // Component Rendering
  "components render correctly": "components",
  "component rendering": "components",
  "components": "components",

  // Props Handling
  "state/props handled correctly": "props",
  "props handling": "props",
  "props": "props",

  // State Updates
  "state updates": "state",
  "state": "state",

  // Routing
  "routing works": "routing",
  "routing": "routing",

  // API Integration
  "api integration": "api",
  "api": "api",

  // Code Structure — not testable via Playwright; default to pass
  "code structure": "structure",
  "structure": "structure",
};

/**
 * Scores a submission by mapping test results to rubric criteria weights.
 *
 * @param {Object} testResults - { components, props, state, routing, api, logs }
 * @param {Object} rubric      - { criteria: [{ name, weight }] }
 * @returns {Promise<Object>}  - Standard evaluation output
 */
export default async function scoreSubmission(testResults, rubric) {
  let totalScore = 0;
  const breakdown = {};
  const warnings = [];

  rubric.criteria.forEach((criteria) => {
    const { name, weight } = criteria;

    // Normalize rubric name to a lookup key
    const lookupKey = CRITERIA_KEY_MAP[name.toLowerCase().trim()];

    if (!lookupKey) {
      warnings.push(`Unknown rubric criterion: "${name}" — skipped`);
      breakdown[name] = 0;
      return;
    }

    // "structure" cannot be tested via Playwright — give benefit of the doubt
    const passed = lookupKey === "structure" ? true : Boolean(testResults[lookupKey]);
    const score = passed ? weight : 0;

    breakdown[name] = score;
    totalScore += score;

    if (!passed) {
      warnings.push(`"${name}" test failed — 0/${weight} points`);
    }
  });

  const status = totalScore >= 50 ? "pass" : "fail";

  // Generate AI feedback (falls back to rule-based if OpenAI key not set)
  logger.info("Generating feedback for score:", totalScore);
  const feedback = await generateAIFeedback({
    rubric_breakdown: breakdown,
    score: totalScore,
    warnings,
    execution_logs: testResults.logs || "",
  });

  return {
    score: totalScore,
    rubric_breakdown: breakdown,
    feedback,
    warnings,
    execution_logs: testResults.logs || "",
    status,
  };
}

/**
 * Generates a simple dynamic feedback string based on what passed/failed.
 */
function generateFeedback(breakdown, totalScore, rubric) {
  const maxScore = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
  const failedCriteria = Object.entries(breakdown)
    .filter(([, score]) => score === 0)
    .map(([name]) => name);

  if (failedCriteria.length === 0) {
    return `Excellent work! All criteria passed. Score: ${totalScore}/${maxScore}.`;
  }

  return (
    `Score: ${totalScore}/${maxScore}. ` +
    `The following criteria need improvement: ${failedCriteria.join(", ")}.`
  );
}
