import extractSubmission from "./extract.js"
import runTests from "./runner.js";
import scoreSubmission from "./scorer.js";

export async function evaluate(params) {
    try {
        const {
            assignment_id,
            student_id,
            submission_zip_path,
            rubric_json
        } = params

        console.log("Starting evaluation for :",student_id);

        // step 1: Extract submission 
        const projectPath = await extractSubmission(submission_zip_path)

            // Step 2: Run tests
        const testResults = await runTests(projectPath);


        // Step 3: Score using rubric 
        const result = await scoreSubmission(testResults, rubric_json);

        return result;

    }catch(error) {
        return {
            score: 0,
            rubric_breakdown: [],
            feedback: "Evaluation failed",
            warnings:[],
            execution_logs: error.message,
            status:"fail"
        }
    }
}