import { z } from "zod";
import { evaluate } from "../evaluator/index.js";
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
      const result = await evaluate(finalParams);
      log.info("Evaluation complete. Score:", result.score, "| Status:", result.status);
      
      // Cleanup temp file if it was an upload
      if (request.isMultipart() && finalParams.submission_zip_path) {
          try { await fs.remove(finalParams.submission_zip_path); } catch (e) {}
      }

      return { success: true, result };

    } catch (error) {
      log.error("Evaluation failed:", error.message);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });
}

