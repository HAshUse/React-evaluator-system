# Postman Testing Guide: React Evaluator API

Follow these instructions to test the React Evaluator API using Postman.

## 1. Server Configuration
Ensure your server is running. By default, it runs on:
- **Base URL**: `http://localhost:4000`
- **Port**: `4000`

> **Note:** The server now uses **E2B Cloud Sandboxes**. Make sure you have `E2B_API_KEY` set in your `.env` file!

## 2. API Endpoint: Evaluate Submission
This endpoint evaluates a React assignment submission based on a provided rubric.

- **Method**: `POST`
- **URL**: `http://localhost:4000/evaluate`
- **Headers**: 
    - Postman will automatically set `Content-Type: multipart/form-data` when using the form-data body.

### Request Body (form-data)
In Postman, go to the **Body** tab and select **form-data**. Add the following key-value pairs:

| Key | Type | Value / Description |
| :--- | :--- | :--- |
| `submission_file` | **File** | Select the `.zip` file from your computer (e.g., `sample-react-app.zip`). |
| `assignment_id` | Text | `assignment-123` |
| `student_id` | Text | `student-456` |
| `rubric_json` | Text | Paste a JSON string for your rubric, e.g.:<br>`{"criteria": [{"name": "Components", "weight": 40}, {"name": "State", "weight": 60}]}` |
| `evaluator_type` | Text | (Optional) `playwright-ai` |
| `reference_project` | Text | (Optional) `optional-reference-id` |

*Note: You can still alternatively send a raw JSON request with `submission_zip_path` if the file already exists locally on the server, but `form-data` is the standard approach for external uploads.*

## 3. Asynchronous Queue Processing

The evaluator now uses an asynchronous job queue (BullMQ + Redis) to handle hundreds of students concurrently. This means the `POST /evaluate` endpoint no longer blocks for minutes. Instead, it instantly responds with a highly-scalable `jobId`.

### Queued Successfully (200 OK)
```json
{
  "success": true,
  "message": "Evaluation queued. Poll /evaluate/:jobId to check status.",
  "jobId": "1",
  "status": "pending"
}
```

### Error (400 Bad Request)
If the request body is missing required fields.
```json
{
  "success": false,
  "error": "Invalid request data",
  "details": "Missing submission file or path"
}
```

## 4. API Endpoint: Poll Job Status
Use this endpoint to check the live status of an evaluation job and retrieve its final score.

- **Method**: `GET`
- **URL**: `http://localhost:4000/evaluate/:jobId` (replace `:jobId` with the ID returned from the POST request, e.g., `1`)

### Polling Still Processing (200 OK)
If the job is still running in the E2B Cloud Sandbox.
```json
{
  "success": true,
  "jobId": "1",
  "status": "active",
  "result": null,
  "error": null
}
```

### Polling Completed (200 OK)
When the evaluation finishes, the full grade is available inside `result`.
```json
{
  "success": true,
  "jobId": "1",
  "status": "completed",
  "result": {
    "score": 85,
    "rubric_breakdown": {
      "Functional Requirements": 60,
      "Code Structure": 25
    },
    "feedback": "Great work overall! Take note of hook dependencies...",
    "warnings": [],
    "execution_logs": "=== npm run build ===\n...",
    "status": "pass"
  },
  "error": null
}
```

### Polling System Error (200 OK)
If the E2B sandbox crashed entirely (e.g. timeout or fatal Docker startup error).
```json
{
  "success": true,
  "jobId": "1",
  "status": "failed",
  "result": null,
  "error": "Detailed error message here"
}
```
