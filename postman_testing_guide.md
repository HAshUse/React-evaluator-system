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

## 3. Expected Responses

### Success (200 OK)
The response will contain the evaluation results and an overall score.
```json
{
  "success": true,
  "result": {
    "score": 85,
    "status": "fail",
    "details": "..."
  }
}
```

### Error (400 Bad Request)
If the request body is missing required fields or has invalid types.
```json
{
  "success": false,
  "error": "Invalid request data",
  "details": "Missing submission file or path"
}
```

### Error (500 Internal Server Error)
If something goes wrong during the evaluation process (e.g., E2B cloud sandbox errors, dependency installation failures).
```json
{
  "success": false,
  "error": "Detailed error message here"
}
```
