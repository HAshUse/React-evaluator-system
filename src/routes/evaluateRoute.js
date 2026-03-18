import { z } from "zod";
import { evaluate } from "../evaluator/index.js";
import logger from "../utils/logger.js";

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
  submission_zip_path: z.string().min(1),
  rubric_json:         rubricSchema,
  evaluator_type:      z.string().optional(),
  reference_project:   z.string().optional(),
});

// ── Route Handler ─────────────────────────────────────────────────────────────
export default async function evaluateRoute(fastify, options) {
  fastify.post("/", async (request, reply) => {

    // Validate request body with Zod
    const parsed = evaluationSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return {
        success: false,
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const params = parsed.data;
    const log = logger.child(`student:${params.student_id}`);
    log.info("Evaluation request received for assignment:", params.assignment_id);

    try {
      const result = await evaluate(params);
      log.info("Evaluation complete. Score:", result.score, "| Status:", result.status);
      return { success: true, result };

    } catch (error) {
      log.error("Evaluation failed:", error.message);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });
}
