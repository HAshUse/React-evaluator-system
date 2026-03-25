import "dotenv/config";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";
import { performance } from "perf_hooks";

const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const MOCK_ZIP = "mock-app.zip";
const BATCH_SIZE = 10;

async function runBatchTest() {
  console.log(`Starting batch test. Submitting ${BATCH_SIZE} zip files to ${BASE_URL}...`);
  
  if (!fs.existsSync(MOCK_ZIP)) {
    console.error("mock-app.zip not found!");
    process.exit(1);
  }

  const formData = new FormData();
  for (let i = 0; i < BATCH_SIZE; i++) {
    formData.append("submission_file", fs.createReadStream(MOCK_ZIP));
  }
  
  formData.append("assignment_id", "batch-test");
  formData.append("student_id", "batch-student");
  formData.append("rubric_json", JSON.stringify({ criteria: [{name: "General", weight: 100}]}));
  formData.append("evaluator_type", "playwright-ai");

  try {
    const postStart = performance.now();
    const response = await fetch(`${BASE_URL}/evaluate`, {
      method: "POST",
      body: formData
    });
    const postEnd = performance.now();
    const data = await response.json();
    
    if (!data.success || !data.jobIds) {
      console.error("Submission failed:", data);
      return;
    }
    
    console.log(`Successfully queued ${data.jobIds.length} jobs in ${((postEnd - postStart) / 1000).toFixed(2)}s. Job IDs:`);
    console.log(data.jobIds);
    
    const jobTimings = {};
    const jobStartTime = performance.now();
    
    const pollJob = async (jobId) => {
      while (true) {
        const res = await fetch(`${BASE_URL}/evaluate/${jobId}`);
        const statusData = await res.json();
        
        if (statusData.status === "completed" || statusData.status === "failed") {
          const endTime = performance.now();
          const elapsedSecs = ((endTime - jobStartTime) / 1000).toFixed(2);
          jobTimings[jobId] = { status: statusData.status, timeSecs: elapsedSecs };
          console.log(`✅ Job ${jobId} finished (${statusData.status}) in ${elapsedSecs} seconds.`);
          break;
        }
        await new Promise(r => setTimeout(r, 3000)); // Poll every 3 seconds
      }
    };
    
    // Run polls concurrently
    await Promise.all(data.jobIds.map(pollJob));
    
    console.log("\n====== FINAL BATCH TIMINGS ======");
    data.jobIds.forEach((jobId, idx) => {
      console.log(`Job ${idx + 1}: ${jobId} -> ${jobTimings[jobId].timeSecs}s (${jobTimings[jobId].status})`);
    });
    console.log("=================================");
    
  } catch (err) {
    console.error("Batch Request Failed:", err);
  }
}

runBatchTest();
