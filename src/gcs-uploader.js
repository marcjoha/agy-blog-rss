import { Storage } from '@google-cloud/storage';

/**
 * Uploads the generated RSS feed to a Google Cloud Storage bucket.
 * @param {string} rssXml - RSS 2.0 XML string
 * @param {string} bucketName
 * @returns {Promise<{fileName: string, publicUrl: string}>}
 */
export async function uploadFeed(rssXml, bucketName) {
  if (!bucketName) {
    throw new Error('GCS bucket name is required for upload');
  }

  const storage = new Storage();
  const file = storage.bucket(bucketName).file('rss.xml');

  await file.save(rssXml, {
    metadata: {
      contentType: 'application/rss+xml; charset=utf-8',
      cacheControl: 'public, max-age=14400, s-maxage=14400',
    },
    resumable: false,
  });

  return {
    fileName: 'rss.xml',
    publicUrl: `https://storage.googleapis.com/${bucketName}/rss.xml`,
  };
}
