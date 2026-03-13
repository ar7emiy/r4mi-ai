# Deploying r4mi-ai to Google Cloud Run

## Architecture on Cloud

```
Internet
  └── Cloud Run: r4mi-frontend  (nginx serving React SPA + /api/* proxy)
        └── Cloud Run: r4mi-backend   (FastAPI + SQLite)
              └── Gemini API  (text-embedding-004, gemini-2.5-flash)
```

Both services are deployed to Cloud Run. The frontend nginx proxies all `/api/*` requests to the backend Cloud Run URL, so the browser never makes cross-origin API calls. No API gateway or load balancer required.

**SQLite note:** Cloud Run's filesystem is ephemeral and resets on cold start. `DEMO_SESSION_SEED=true` pre-loads the 2 required prior sessions on every startup — this is intentional and sufficient for the demo. For production persistence, swap SQLite for Cloud SQL (PostgreSQL).

---

## Manual Steps (Do These Once)

These require a human with GCP Owner or Editor access.

### 1. Select or Create a GCP Project

```bash
# Create a new project
gcloud projects create r4mi-ai-demo --name="r4mi-ai Demo"
gcloud config set project r4mi-ai-demo

# Or use an existing project
gcloud config set project YOUR_PROJECT_ID
```

Enable billing on the project if it isn't already (required for Cloud Run and Artifact Registry).

### 2. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create r4mi-ai \
  --repository-format=docker \
  --location=us-central1 \
  --description="r4mi-ai container images"
```

### 4. Store the Gemini API Key as a Secret

```bash
echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create gemini-api-key \
  --data-file=-
```

To update the key later:
```bash
echo -n "NEW_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
```

### 5. Grant Cloud Build Access to the Secret

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) \
  --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Also grant to the Compute service account (used by Cloud Run at runtime)
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 6. Configure Docker Authentication

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## First Deployment (Manual — Gets Backend URL)

Because the frontend nginx must know the backend URL at startup, the backend must be deployed first. Run these commands once to get the stable backend Cloud Run URL.

```bash
PROJECT=$(gcloud config get-value project)
REGION=us-central1
REPO=us-central1-docker.pkg.dev/${PROJECT}/r4mi-ai

# Build and push backend
docker build -t ${REPO}/backend:latest ./backend
docker push ${REPO}/backend:latest

# Deploy backend
gcloud run deploy r4mi-backend \
  --image=${REPO}/backend:latest \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --port=8000 \
  --timeout=3600 \
  --min-instances=1 \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=false,\
DATABASE_URL=sqlite:////tmp/r4mi.db,\
PATTERN_THRESHOLD=3,\
PATTERN_CONFIDENCE_MIN=0.85,\
AGENTVERSE_MATCH_THRESHOLD=0.85,\
DEMO_USER_ID=permit-tech-001,\
DEMO_SESSION_SEED=true,\
VISION_CACHE_TTL=300"

# Capture the backend URL — you will need this forever after
BACKEND_URL=$(gcloud run services describe r4mi-backend \
  --region=${REGION} \
  --format='value(status.url)')
echo "Backend URL: ${BACKEND_URL}"
# → https://r4mi-backend-xxxxxxxxxx-uc.a.run.app
```

**Save this URL.** It is stable for the lifetime of the Cloud Run service. Add it as `_BACKEND_URL` in your Cloud Build trigger substitutions (see below).

```bash
# Build and push frontend
docker build -t ${REPO}/frontend:latest ./frontend
docker push ${REPO}/frontend:latest

# Deploy frontend — pass the backend URL as an env var
gcloud run deploy r4mi-frontend \
  --image=${REPO}/frontend:latest \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --timeout=3600 \
  --min-instances=1 \
  --set-env-vars="BACKEND_URL=${BACKEND_URL}"

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe r4mi-frontend \
  --region=${REGION} \
  --format='value(status.url)')
echo "App is live at: ${FRONTEND_URL}"
```

---

## Subsequent Deployments via Cloud Build

After the first manual deploy, use `cloudbuild.yaml` for every subsequent push. Set up a trigger:

1. Go to **Cloud Build → Triggers → Create Trigger** in the GCP Console
2. Connect to your GitHub repository
3. Set branch filter to `main` (or `^main$`)
4. Point to `cloudbuild.yaml` in the root
5. Add these **substitution variables**:

| Variable | Value |
|----------|-------|
| `_PROJECT` | your GCP project ID |
| `_REGION` | `us-central1` |
| `_BACKEND_URL` | the Cloud Run URL from the first deploy |

Or trigger manually:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=\
_PROJECT=r4mi-ai-demo,\
_REGION=us-central1,\
_BACKEND_URL=https://r4mi-backend-xxxxxxxxxx-uc.a.run.app
```

---

## Post-Deployment Verification

```bash
# Backend health check
curl ${BACKEND_URL}/health
# → {"status": "ok"}

# Seed data loaded
curl ${BACKEND_URL}/api/stubs/applications | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'applications')"
# → 9 applications

# Frontend loads
curl -s ${FRONTEND_URL} | grep -o "r4mi-ai" | head -1
# → r4mi-ai
```

---

## Playwright Tests Against Cloud

To run the E2E suite against the deployed Cloud URL:

```bash
cd e2e
PLAYWRIGHT_BASE_URL=https://r4mi-frontend-xxxxxxxxxx-uc.a.run.app \
  npx playwright test health
```

For the full demo test, update `baseURL` in `e2e/playwright.config.ts` or pass via env.

---

## Operational Notes

| Topic | Detail |
|-------|--------|
| **SQLite persistence** | Ephemeral — resets on cold start. `DEMO_SESSION_SEED=true` handles this by pre-loading 2 sessions automatically. |
| **SSE connections** | Request timeout set to 3600s. Min instances = 1 prevents cold starts from dropping live SSE connections during demo. |
| **Gemini billing** | ~6 Gemini API calls per full demo run-through. Free tier is sufficient for testing; enable billing if you hit quota limits. |
| **CORS** | Not an issue — frontend nginx proxies all `/api/*` to backend, so the browser only sees the frontend origin. |
| **Backend URL stability** | Cloud Run service URLs are stable (the hash suffix doesn't change after creation). You only need to capture `_BACKEND_URL` once. |
| **Updating backend URL** | If you ever delete and recreate the backend service, rebuild and redeploy the frontend with the new `BACKEND_URL` env var. |
