/**
 * logger.js
 *
 * A lightweight structured logger for the React Evaluator.
 * Prefixes every message with a timestamp and log level so logs
 * are easy to filter and read in the execution_logs output.
 *
 * Usage:
 *   import logger from "../utils/logger.js";
 *   logger.info("Starting evaluation for student:", studentId);
 *   logger.error("Docker failed:", err.message);
 */

const LOG_LEVELS = {
  INFO:  "INFO ",
  WARN:  "WARN ",
  ERROR: "ERROR",
  DEBUG: "DEBUG",
};

/**
 * Formats a log message with timestamp and level prefix.
 * @param {string} level
 * @param {string} message
 * @param {...any} args
 * @returns {string}
 */
function format(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const extra = args.length > 0
    ? " " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")
    : "";
  return `[${timestamp}] [${level}] ${message}${extra}`;
}

const logger = {
  /**
   * Informational message — normal operation events.
   * @param {string} message
   * @param {...any} args
   */
  info(message, ...args) {
    const line = format(LOG_LEVELS.INFO, message, ...args);
    console.log(line);
    return line;
  },

  /**
   * Warning — something unexpected but non-fatal happened.
   * @param {string} message
   * @param {...any} args
   */
  warn(message, ...args) {
    const line = format(LOG_LEVELS.WARN, message, ...args);
    console.warn(line);
    return line;
  },

  /**
   * Error — a failure that affects evaluation output.
   * @param {string} message
   * @param {...any} args
   */
  error(message, ...args) {
    const line = format(LOG_LEVELS.ERROR, message, ...args);
    console.error(line);
    return line;
  },

  /**
   * Debug — verbose detail, useful during development.
   * Only printed when NODE_ENV !== "production".
   * @param {string} message
   * @param {...any} args
   */
  debug(message, ...args) {
    if (process.env.NODE_ENV === "production") return "";
    const line = format(LOG_LEVELS.DEBUG, message, ...args);
    console.log(line);
    return line;
  },

  /**
   * Create a child logger that prefixes every message with a context label.
   * Useful for tagging logs by student_id or assignment_id.
   *
   * @param {string} context - e.g. "student:S1" or "assignment:A1"
   * @returns {object} - Child logger with same API
   */
  child(context) {
    const prefix = `[${context}]`;
    return {
      info:  (msg, ...a) => logger.info(`${prefix} ${msg}`, ...a),
      warn:  (msg, ...a) => logger.warn(`${prefix} ${msg}`, ...a),
      error: (msg, ...a) => logger.error(`${prefix} ${msg}`, ...a),
      debug: (msg, ...a) => logger.debug(`${prefix} ${msg}`, ...a),
    };
  },
};

export default logger;
