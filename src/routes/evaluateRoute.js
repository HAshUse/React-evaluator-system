import { z } from "zod";
import { addEvaluationJob, evaluationQueue } from "../queue/evaluationQueue.js";
import logger from "../utils/logger.js";
import fs from "fs-extra";
import path from "path";
import tmp from "tmp";
import { pipeline } from "stream/promises";
import AdmZip from "adm-zip";


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
  submission_zip_path: z.union([z.string(), z.array(z.string())]).optional(),
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
      let uploadedFilePaths = [];

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'submission_file') {
          // Save uploaded file to a temp location
          const tempFile = tmp.fileSync({ postfix: '.zip', keep: true });
          await pipeline(part.file, fs.createWriteStream(tempFile.name));
          uploadedFilePaths.push(tempFile.name);

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

      if (uploadedFilePaths.length > 0) {
        params.submission_zip_path = uploadedFilePaths.length === 1 ? uploadedFilePaths[0] : uploadedFilePaths;
      }
    } else {
      params = request.body;
    }

    // Validate request body with Zod
    const parsed = evaluationSchema.safeParse(params);

    if (!parsed.success || !params.submission_zip_path) {
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
      const jobIds = [];
      const paths = Array.isArray(finalParams.submission_zip_path) 
        ? finalParams.submission_zip_path 
        : [finalParams.submission_zip_path].filter(Boolean);

      // Validate that provided zip files contain a package.json
      const validPaths = [];
      const validationErrors = [];

      for (const zipPath of paths) {
        if (zipPath) {
          try {
            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();
            const hasPackageJson = zipEntries.some(entry => {
              const parts = entry.entryName.split('/');
              return !entry.isDirectory && parts[parts.length - 1] === 'package.json';
            });
            
            if (!hasPackageJson) {
              validationErrors.push({ file: zipPath, error: "Missing package.json file" });
              try { await fs.remove(zipPath); } catch (e) {}
            } else {
              validPaths.push(zipPath);
            }
          } catch (e) {
            validationErrors.push({ file: zipPath, error: "Invalid zip file format" });
            try { await fs.remove(zipPath); } catch (e) {}
          }
        }
      }

      if (paths.length > 0 && validPaths.length === 0) {
        reply.code(400);
        return {
          success: false,
          error: "Invalid submissions",
          details: validationErrors
        };
      }

      const pathsToProcess = paths.length > 0 ? validPaths : [];
      const loopCount = Math.max(pathsToProcess.length, paths.length === 0 ? 1 : 0);

      // Loop over the valid files (or at least run once if no files but valid local path is provided)
      for (let i = 0; i < loopCount; i++) {
        const currentPath = pathsToProcess[i] || null;
        const jobParams = { ...finalParams, is_multipart: request.isMultipart() };
        if (currentPath) jobParams.submission_zip_path = currentPath;

        const job = await addEvaluationJob(jobParams);
        jobIds.push(job.id);
        log.info(`Queued evaluation job ${job.id}`);
      }
      
      return { 
        success: true, 
        message: "Evaluation queued. Poll /evaluate/:jobId to check status.",
        jobId: jobIds[0], // primary job ID for backwards compatibility
        jobIds: jobIds,   // array of all job IDs for batch tracking
        status: "pending",
        errors: validationErrors.length > 0 ? validationErrors : undefined
      };

    } catch (error) {
      log.error("Failed to queue evaluation:", error.message);
      
      // Cleanup all temp files if queueing fails completely
      if (request.isMultipart() && finalParams.submission_zip_path) {
          const pathsToClean = Array.isArray(finalParams.submission_zip_path) ? finalParams.submission_zip_path : [finalParams.submission_zip_path];
          for (const p of pathsToClean) {
            try { await fs.remove(p); } catch (e) {}
          }
      }
      
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // GET /evaluate/:jobId
  // Poll this endpoint to check if an evaluation is finished.
  fastify.get("/:jobId", async (request, reply) => {
    const jobIds = request.params.jobId.split(',');

    if (jobIds.length === 1) {
      const jobId = jobIds[0];
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
    }

    const batchResults = [];
    for (const id of jobIds) {
      const trimmedId = id.trim();
      if (!trimmedId) continue;
      
      const job = await evaluationQueue.getJob(trimmedId);
      if (!job) {
        batchResults.push({ jobId: trimmedId, success: false, error: "Not found" });
        continue;
      }
      
      const state = await job.getState();
      batchResults.push({
        success: true,
        jobId: trimmedId,
        status: state,
        result: job.returnvalue || null,
        error: job.failedReason || null
      });
    }

    return {
      success: true,
      results: batchResults
    };
  });
}

