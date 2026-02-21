# Deploy to Cloud Run

## 1) Build image with Cloud Build
```bash
gcloud builds submit --config cloudbuild.yaml --substitutions _IMAGE=us-central1-docker.pkg.dev/$PROJECT_ID/hackathon/support-automation-factory:latest .
```

## 2) Deploy to Cloud Run
```bash
gcloud run deploy support-automation-factory \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/hackathon/support-automation-factory:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 3) Verify
- Open the service URL.
- Run through end-to-end demo flow.
- Save screenshot + URL for Devpost.
