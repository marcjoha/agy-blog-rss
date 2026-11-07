import { Storage } from '@google-cloud/storage';

/**
 * Uploads all generated feeds (RSS, Atom, JSON) to a Google Cloud Storage bucket.
 * @param {{rss?: string, atom?: string, json?: string}} feeds
 * @param {string} bucketName
 * @returns {Promise<Array<{fileName: string, publicUrl: string}>>}
 */
export async function uploadFeeds(feeds, bucketName) {
  if (!bucketName) {
    throw new Error('GCS bucket name is required for upload');
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const uploads = [
    { name: 'rss.xml', content: feeds.rss, contentType: 'application/rss+xml; charset=utf-8' },
    { name: 'atom.xml', content: feeds.atom, contentType: 'application/atom+xml; charset=utf-8' },
    { name: 'feed.json', content: feeds.json, contentType: 'application/feed+json; charset=utf-8' },
  ].filter((item) => Boolean(item.content));

  await Promise.all(
    uploads.map(({ name, content, contentType }) =>
      bucket.file(name).save(content, {
        metadata: {
          contentType,
          cacheControl: 'public, max-age=7200, s-maxage=7200',
        },
        resumable: false,
      })
    )
  );

  return uploads.map(({ name }) => ({
    fileName: name,
    publicUrl: `https://storage.googleapis.com/${bucketName}/${name}`,
  }));
}

/**
 * Uploads the generated RSS feed to a Google Cloud Storage bucket.
 * @param {string} rssXml - RSS 2.0 XML string
 * @param {string} bucketName
 * @returns {Promise<{fileName: string, publicUrl: string}>}
 */
export async function uploadFeed(rssXml, bucketName) {
  const results = await uploadFeeds({ rss: rssXml }, bucketName);
  return results[0];
}
