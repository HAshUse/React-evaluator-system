import path from "path";
import fetch from "node-fetch";

const RUN_LOCAL = true; // Use URL if server running, else function directly

async function runLocalTest() {
  const zipPath = path.resolve("./mock-app/mock-submission.zip");
  
  const rubric = {
    criteria: [
      { name: "Components render correctly", weight: 20 },
      { name: "Props handling", weight: 20 }, // Intentionally designed to fail
      { name: "State updates", weight: 20 },
      { name: "Routing works", weight: 20 },
      { name: "API integration", weight: 20 }
    ]
  };

  const payload = {
    assignment_id: "test-assignment-1",
    student_id: "student-mock-123",
    submission_zip_path: zipPath,
    rubric_json: rubric
  };

  console.log("Sending evaluation request to http://localhost:4000/evaluate ...");
  
  try {
    const response = await fetch("http://localhost:4000/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("\n================ EVALUATION RESULT ================\n");
    console.dir(data, { depth: null, colors: true });
    console.log("\n===================================================\n");

  } catch (err) {
    console.error("Test Request Failed:", err.message);
    console.log("Is the evaluator server running on port 4000? (npm start)");
  }
}

runLocalTest();
