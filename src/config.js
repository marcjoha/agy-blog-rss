const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || '';

export const config = {
  port: Number(process.env.PORT) || 8080,
  gcsBucketName: GCS_BUCKET_NAME,
  feedBaseUrl: process.env.FEED_BASE_URL
    || (GCS_BUCKET_NAME ? `https://storage.googleapis.com/${GCS_BUCKET_NAME}` : 'https://antigravity.google/blog'),
};
