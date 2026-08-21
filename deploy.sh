#!/usr/bin/env bash
set -euo pipefail

# Configuration
REGION="${GCP_REGION:-europe-north2}"
SCHEDULER_REGION="${GCP_SCHEDULER_REGION:-europe-west1}"
SERVICE_NAME="agy-blog-rss"
JOB_NAME="agy-blog-rss-scheduler"
PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
BUCKET_NAME="${GCS_BUCKET_NAME:-antigravity-blog-feed}"
SCHEDULE="15 */2 * * *"

echo "=== Deploying Antigravity Blog RSS Generator to GCP ==="
echo "Project:   ${PROJECT_ID}"
echo "Run/GCS:   ${REGION}"
echo "Scheduler: ${SCHEDULER_REGION}"
echo "Bucket:    ${BUCKET_NAME}"

# 1. Enable required GCP services
echo "Enabling GCP APIs (run, cloudscheduler, storage)..."
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com

# 2. Ensure GCS bucket exists and is publicly readable for static XML
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" &>/dev/null; then
  echo "Creating storage bucket gs://${BUCKET_NAME} in ${REGION}..."
  gcloud storage buckets create "gs://${BUCKET_NAME}" --location="${REGION}" --uniform-bucket-level-access
  echo "Granting public read permissions on gs://${BUCKET_NAME}..."
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
    --member="allUsers" \
    --role="roles/storage.objectViewer"
fi

# 3. Grant default compute service account storage admin permissions for uploads
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.objectAdmin" 2>/dev/null || true

# 4. Deploy to Cloud Run using --no-build
echo "Deploying Cloud Run service ${SERVICE_NAME}..."
gcloud beta run deploy "${SERVICE_NAME}" \
  --source="." \
  --no-build \
  --base-image="nodejs22" \
  --command="node,src/index.js" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --quiet \
  --set-env-vars="GCS_BUCKET_NAME=${BUCKET_NAME},FEED_BASE_URL=https://storage.googleapis.com/${BUCKET_NAME}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format="value(status.url)")
echo "Service deployed at: ${SERVICE_URL}"

# 5. Create or update Cloud Scheduler trigger (15 */4 * * *)
echo "Setting up Cloud Scheduler job ${JOB_NAME} (${SCHEDULE}) in ${SCHEDULER_REGION}..."
if gcloud scheduler jobs describe "${JOB_NAME}" --location="${SCHEDULER_REGION}" &>/dev/null; then
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --location="${SCHEDULER_REGION}" \
    --schedule="${SCHEDULE}" \
    --uri="${SERVICE_URL}/scrape" \
    --http-method=POST
else
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --location="${SCHEDULER_REGION}" \
    --schedule="${SCHEDULE}" \
    --uri="${SERVICE_URL}/scrape" \
    --http-method=POST
fi

# 6. Trigger initial scrape
echo "Triggering initial scrape to generate feed..."
curl -s -X POST "${SERVICE_URL}/scrape"
echo ""

echo "=== Deployment Complete ==="
echo "Public Feed URL:"
echo "- RSS 2.0: https://storage.googleapis.com/${BUCKET_NAME}/rss.xml"
