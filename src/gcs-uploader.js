import { Storage } from '@google-cloud/storage';

/**
 * Uploads generated RSS feed file to a Google Cloud Storage bucket.
 * @param {{rss: string}} feeds
 * @param {string} bucketName
 * @param {{makePublic?: boolean}} options
 * @returns {Promise<Array<{fileName: string, publicUrl: string}>>}
 */
export async function uploadFeedsToGCS(feeds, bucketName, options = {}) {
  if (!bucketName) {
    throw new Error('GCS bucket name is required for upload');
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const file = bucket.file('rss.xml');
  await file.save(feeds.rss, {
    metadata: {
      contentType: 'application/rss+xml; charset=utf-8',
      cacheControl: 'public, max-age=14400, s-maxage=14400'
    },
    resumable: false
  });

  if (options.makePublic) {
    try {
      await file.makePublic();
    } catch (err) {
      console.warn('Could not set public ACL for rss.xml:', err.message);
    }
  }

  return [
    {
      fileName: 'rss.xml',
      publicUrl: `https://storage.googleapis.com/${bucketName}/rss.xml`
    }
  ];
}
