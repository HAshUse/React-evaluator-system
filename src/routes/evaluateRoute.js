import { z } from "zod";
import { addEvaluationJob, evaluationQueue } from "../queue/evaluationQueue.js";
import logger from "../utils/logger.js";
import fs from "fs-extra";
import path from "path";
import tmp from "tmp";
import { pipeline } from "stream/promises";


// ── Input Validation Schema ──────────────────────────────────────────────────
const rubricCriteriaSchema = z.object({
  name: z.string().min(1),
  weight: z.number().positive(),
});

const rubricSchema = z.object({
  criteria: z.array(rubricCriteriaSchema).min(1),
});

const evaluationSchema = z.object({
  assignment_id:       z.string().min(1),
  student_id:          z.string().min(1),
  submission_zip_path: z.string().optional(),
  rubric_json:         rubricSchema,
  evaluator_type:      z.string().optional(),
  reference_project:   z.string().optional(),
});

// ── Route Handler ─────────────────────────────────────────────────────────────
export default async function evaluateRoute(fastify, options) {
  fastify.post("/", async (request, reply) => {
    let params = {};

    if (request.isMultipart()) {
      const parts = request.parts();
      let uploadedFilePath = null;

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'submission_file') {
          // Save uploaded file to a temp location
          const tempFile = tmp.fileSync({ postfix: '.zip', keep: true });
          await pipeline(part.file, fs.createWriteStream(tempFile.name));
          uploadedFilePath = tempFile.name;

        } else if (part.type === 'field') {
          // Parse JSON fields
          if (part.fieldname === 'rubric_json') {
            try {
              params[part.fieldname] = JSON.parse(part.value);
            } catch (e) {
              params[part.fieldname] = part.value; 
            }
          } else {
            params[part.fieldname] = part.value;
          }
        }
      }

      if (uploadedFilePath) {
        params.submission_zip_path = uploadedFilePath;
      }
    } else {
      params = request.body;
    }

    // Validate request body with Zod
    const parsed = evaluationSchema.safeParse(params);

    if (!parsed.success || (!params.submission_zip_path && !request.isMultipart())) {
      reply.code(400);
      return {
        success: false,
        error: "Invalid request data",
        details: parsed.error ? parsed.error.flatten().fieldErrors : "Missing submission file or path",
      };
    }

    const finalParams = parsed.data;
    const log = logger.child(`student:${finalParams.student_id}`);
    log.info("Evaluation request received for assignment:", finalParams.assignment_id);

    try {
      // Add the evaluation parameters to the BullMQ processing queue
      const job = await addEvaluationJob({ 
        ...finalParams, 
        is_multipart: request.isMultipart() 
      });
      
      log.info(`Queued evaluation job ${job.id}`);
      
      return { 
        success: true, 
        message: "Evaluation queued. Poll /evaluate/:jobId to check status.",
        jobId: job.id,
        status: "pending" 
      };

    } catch (error) {
      log.error("Failed to queue evaluation:", error.message);
      
      // Cleanup temp file immediately if queueing fails
      if (request.isMultipart() && finalParams.submission_zip_path) {
          try { await fs.remove(finalParams.submission_zip_path); } catch (e) {}
      }
      
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // GET /evaluate/:jobId
  // Poll this endpoint to check if an evaluation is finished.
  fastify.get("/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    const job = await evaluationQueue.getJob(jobId);
    
    if (!job) {
      reply.code(404);
      return { success: false, error: "Job trace not found or already deleted" };
    }
    
    const state = await job.getState();
    const result = job.returnvalue;
    const errorReason = job.failedReason;
    
    return {
      success: true,
      jobId,
      status: state,
      result: result || null,
      error: errorReason || null
    };
  });
}

