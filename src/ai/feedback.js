/**
 * Requires: GROQ_API_KEY in .env file
 */

import OpenAI from "openai";
import logger from "../utils/logger.js";

let client = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.warn("GROQ_API_KEY not set — AI feedback will be skipped.");
    return null;
  }

  // Groq is OpenAI API-compatible — just point baseURL to Groq's endpoint
  client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  logger.info("Groq client initialised.");
  return client;
}

/**
 * Generates AI-assisted feedback for a student's React submission.
 *
 * @param {Object} params
 * @param {Object} params.rubric_breakdown  - { criteriaName: score, ... }
 * @param {number} params.score             - Total score achieved
 * @param {string[]} params.warnings        - Warning messages from scorer
 * @param {string} params.execution_logs    - Raw build/test logs
 *
 * @returns {Promise<string>} feedback - A constructive paragraph of feedback
 */
export async function generateAIFeedback({ rubric_breakdown, score, warnings, execution_logs }) {
  const openai = getClient();

  // Fall back to rule-based summary if Groq is not configured
  if (!openai) {
    return buildFallbackFeedback(rubric_breakdown, score, warnings);
  }

  // Build a concise criteria summary for the prompt
  const criteriaLines = Object.entries(rubric_breakdown)
    .map(([name, points]) =>
      `- ${name}: ${points > 0 ? `PASSED (${points} pts)` : "FAILED (0 pts)"}`
    )
    .join("\n");

  const failedItems = warnings.join("; ") || "None";

  // Trim logs to avoid exceeding token limits
  const logSnippet = execution_logs
    ? execution_logs.slice(-1500)
    : "No logs available.";

  const prompt = `
You are a coding instructor reviewing a student's React assignment submission.

Here are the automated evaluation results:
Score: ${score}/100

Criteria Results:
${criteriaLines}

Issues Detected:
${failedItems}

Relevant Execution Logs (last 1500 chars):
${logSnippet}

Write 2–3 sentences of constructive, encouraging feedback for the student.
- Mention what they did well (passed criteria).
- Clearly point out what needs improvement (failed criteria).
- Suggest one actionable improvement tip.
- Do NOT mention the score number. Keep it friendly and educational.
`.trim();

  try {
    logger.debug("Sending prompt to Groq...");

    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",   // Stable Groq model
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.6,
    });

    const feedback = response.choices[0]?.message?.content?.trim();
    logger.info("AI feedback received from Groq.");
    return feedback || buildFallbackFeedback(rubric_breakdown, score, warnings);

  } catch (err) {
    logger.error("Groq API call failed:", err.message);
    // Never let AI failure break evaluation — fall back gracefully
    return buildFallbackFeedback(rubric_breakdown, score, warnings);
  }
}

/**
 * Rule-based fallback feedback used when Groq is unavailable or fails.
 *
 * @param {Object} rubric_breakdown
 * @param {number} score
 * @param {string[]} warnings
 * @returns {string}
 */
function buildFallbackFeedback(rubric_breakdown, score, warnings) {
  const passed = Object.entries(rubric_breakdown)
    .filter(([, pts]) => pts > 0)
    .map(([name]) => name);

  const failed = Object.entries(rubric_breakdown)
    .filter(([, pts]) => pts === 0)
    .map(([name]) => name);

  if (failed.length === 0) {
    return "Great work! All criteria passed successfully. Your React application is well-structured and functional.";
  }

  const passedStr = passed.length > 0
    ? `You successfully implemented: ${passed.join(", ")}. `
    : "";
  const failedStr = `The following areas need attention: ${failed.join(", ")}. `;
  const tip = "Review the failing criteria and ensure your components, state management, and routing are correctly implemented.";

  return passedStr + failedStr + tip;
}
