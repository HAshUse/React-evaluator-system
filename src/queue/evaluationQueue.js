import { evaluate } from '../evaluator/index.js';
import logger from '../utils/logger.js';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';

// In-Memory Job Storage
const jobs = new Map();

// Mock evaluation Queue class
export const evaluationQueue = {
  async getJob(jobId) {
    if (!jobs.has(jobId)) return null;
    return jobs.get(jobId);
  }
};

const pendingJobs = [];
let activeCount = 0;
const CONCURRENCY_LIMIT = 5;

/**
 * Adds an evaluation job to the in-memory queue and begins processing
 * @param {Object} params - The evaluation parameters
 * @returns {Promise<Object>} - The created Job object
 */
export async function addEvaluationJob(params) {
  const jobId = randomUUID();
  
  const job = {
    id: jobId,
    data: params,
    returnvalue: null,
    failedReason: null,
    async getState() {
      // "pending", "active", "completed", "failed"
      return this.state;
    }
  };
  
  job.state = 'pending';
  jobs.set(jobId, job);
  pendingJobs.push(job);
  
  logger.info(`Added job ${jobId} to the in-memory queue (Pending: ${pendingJobs.length}, Active: ${activeCount}).`);
  
  // Try to start processing queued jobs
  processQueue();
  
  return job;
}

/**
 * Checks the queue and processing limits to start jobs
 */
function processQueue() {
  if (activeCount >= CONCURRENCY_LIMIT || pendingJobs.length === 0) {
    return;
  }
  
  activeCount++;
  const nextJob = pendingJobs.shift();
  
  // Run asynchronously and trigger the queue again when done
  processJob(nextJob).finally(() => {
    activeCount--;
    processQueue();
  });
  
  // Try to spawn another worker if we are still under the limit
  processQueue();
}

/**
 * Processes a job in the background asynchronously
 */
async function processJob(job) {
  job.state = 'active';
  const { student_id, is_multipart, submission_zip_path } = job.data;
  logger.info(`[Worker] Started job ${job.id} for student ${student_id}`);
  
  try {
    const result = await evaluate(job.data);
    job.returnvalue = result;
    job.state = 'completed';
    logger.info(`[Worker] Job ${job.id} completed. Final Score: ${result.score}`);
  } catch (error) {
    job.failedReason = error.message;
    job.state = 'failed';
    logger.error(`[Worker] Job ${job.id} failed: ${error.message}`);
  } finally {
    // Cleanup temporary uploaded zip path if this was a multipart upload
    if (is_multipart && submission_zip_path) {
      try { await fs.remove(submission_zip_path); } catch (e) {}
    }
  }
}
