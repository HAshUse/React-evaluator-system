# 🚀 React Evaluator (AI-Powered Batch Assessment Engine)

A **production-ready React evaluator** that securely assesses student React applications by spinning up dynamic cloud sandboxes, building the projects, and running automated Playwright UI tests along with comprehensive AI feedback.

Built for:
- Education platforms
- Automated React assessments
- Batch evaluation (multiple students at once)
- Secure, isolated execution of untrusted React code

---

## What this Evaluator Does

- Accepts **single or batch ZIP file uploads** containing student React apps.
- Spins up a **secure E2B Cloud Sandbox**.
- Automatically runs `npm install` and `npm run build` safely isolated from your host.
- Serves the compiled application on a container port.
- Executes **Playwright UI tests** against the rendered DOM elements based on a rubric.
- Extracts DOM metrics and consults an LLM (e.g. Groq/OpenAI) for **contextual AI feedback**.
- Returns a structured **JSON response** containing exact scores, rubric breakdowns, and console diagnostics.

---

## 📁 Minimal Folder Structure

```text
react-evaluator/
├── src/
│   ├── evaluator/     # Core pipeline (unpacking, building, invoking Playwright)
│   ├── queue/         # In-memory queue system (async job handling)
│   ├── routes/        # Fastify API routes (e.g., /evaluate)
│   ├── sandbox/       # E2B Sandbox config to securely isolate student environments
│   ├── testing/       # Automated Playwright test runners
│   ├── utils/         # Helper functions and logger
│   └── server.js      # Main Fastify server entry point
├── test-projects/     # Sample mock submissions for quick testing
├── package.json       # App dependencies
└── README.md          # Project documentation
```

---

## 🔗 API Endpoints

### 1. `POST /evaluate`
Evaluates one or multiple student zipped repositories dynamically.

### 2. `GET /evaluate/:jobId`
Used to poll the status of an ongoing evaluation.

---

## Request Payload (Postman Ready)

### Headers
*No manual headers needed if submitting `form-data`.*

### Body (form-data)

| Key | Type | Value |
| :--- | :--- | :--- |
| `submission_file` | **File** | Select the `.zip` file(s) from your computer. |
| `assignment_id` | Text | `assignment-123` |
| `student_id` | Text | `student-456` |
| `rubric_json` | Text | `{"criteria": [{"name": "Components", "weight": 40}, {"name": "State", "weight": 60}]}` |
| `evaluator_type` | Text | `playwright-ai` |

> **Pro-Tip**: You can attach multiple zip files to `submission_file` in one request to queue a batch!

---

## Response Structure

### 1. Initial Queue Response (JSON)
Because React builds take time (often 10s-60s), the API immediately queues your workload:
```json
{
  "success": true,
  "message": "Evaluation queued. Poll /evaluate/:jobId to check status.",
  "jobId": "877c150c-908d-430a-...",
  "jobIds": [
      "877c150c-908d-430a-...",
      "095b850c-1234-430a-..."
  ],
  "status": "pending"
}
```

### 2. Polling Success Response (JSON)
When making a GET request to `/evaluate/:jobId`:
```json
{
  "success": true,
  "jobId": "877c150c-...",
  "status": "completed",
  "result": {
    "score": 85,
    "rubric_breakdown": {
      "Components": 40,
      "State": 45
    },
    "feedback": "Great logic! However your state management could be simplified.",
    "warnings": [],
    "execution_logs": "=== npm run build ===\n...",
    "status": "pass"
  },
  "error": null
}
```

---

## Security & Safety

- Student code is ONLY evaluated inside deep **E2B Sandboxes**.
- The main host machine never touches `node_modules` of the student applications.
- Pre-configured execution timeouts (5-minute max lifespan per container) prevent resource exhaustion or infinite loops.

---

## How to Clone & Run Locally

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/react-evaluator.git
cd react-evaluator
```

### 2. Install Dependencies
Make sure you have **Node.js (v18+)** installed.

```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and ensure you configure your API keys for the sandboxing and AI model providers:
```ini
E2B_API_KEY=your_e2b_key_here
GROQ_API_KEY=your_groq_key_here

# Optional: Configurable endpoints and ports
PORT=4000
BASE_URL=http://localhost:4000
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

### 4. Start the Server

```bash
npm start
```
*The server will boot up and listen on port **4000** by default.*

---

## How to Zip Projects for Submission

Before uploading, ensure your React projects are zipped correctly so the evaluator can extract and build them.

**Important Zip Requirements:**
- The `.zip` file should contain the project files (like `package.json`, `src/`, `public/`) at the root of the zip, OR inside a single top-level folder.
- Do **not** include the `node_modules/` folder, as it makes the upload huge and dependencies will be freshly installed by the sandbox.

### On Windows
1. Open File Explorer and navigate to your React project folder.
2. Select all files and folders inside your project (or just the root project folder). **Note:** Ensure `node_modules` is excluded or deleted first.
3. Right-click > **Compress to ZIP file** (Windows 11) or **Send to** > **Compressed (zipped) folder** (Windows 10).

### On macOS
1. Open Finder and navigate to your React project folder.
2. Select the files/folders (excluding `node_modules`).
3. Right-click (or Control-click) and select **Compress...**.

### Using Command Line (Mac/Linux/Windows via Git Bash)
Navigate to your project folder and run:
```bash
zip -r submission.zip . -x "node_modules/*"
```

---

## How to Test the Application

1. Open **Postman**.
2. Make a **POST** request to `http://localhost:4000/evaluate`.
3. In the **Body** tab, choose **form-data**.
4. Add the parameters (see *Request Payload* section above).
5. For `submission_file`, hover over the Key field edge to change the type from `Text` to `File`, and select a sample zip (like `test-projects/Student-dropouts-2021-22-` packed into a `.zip`).
6. Click **Send**!
7. Use the returned `jobId` to send a **GET** request to `http://localhost:4000/evaluate/:jobId` until it returns `"status": "completed"`.
