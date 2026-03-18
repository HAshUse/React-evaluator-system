import { evaluate } from "../evaluator/index.js";

const rubric = {
  criteria: [
    { name: "components", weight: 30 },
    { name: "state", weight: 35 },
    { name: "routing", weight: 20 },
    { name: "api", weight: 15 },
    { name: "structure", weight: 10 },
  ],
};

async function run() {
    
    const result = await evaluate({
        assignment_id:"A!",
        student_id:"S1",
        submission_zip_path: "./submission.zip",
        rubric_json: rubric
    })

    console.log(result);
}

run()