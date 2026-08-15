import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fetchBlogPosts } from './scraper.js';
import { buildFeeds } from './feed-builder.js';
import { uploadFeedsToGCS } from './gcs-uploader.js';

async function main() {
  console.log('Fetching Google Antigravity blog posts...');
  const startTime = Date.now();

  const posts = await fetchBlogPosts({
    fetchFullContent: true,
    maxPosts: 50
  });

  console.log(`Successfully scraped ${posts.length} blog posts in ${Date.now() - startTime}ms.`);

  const feeds = buildFeeds(posts, {
    feedBaseUrl: process.env.FEED_BASE_URL || (process.env.GCS_BUCKET_NAME ? `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}` : 'https://antigravity.google/blog')
  });

  // Write locally to ./dist
  const distDir = resolve(process.cwd(), 'dist');
  await mkdir(distDir, { recursive: true });

  await writeFile(join(distDir, 'rss.xml'), feeds.rss, 'utf-8');

  console.log(`Feed generated in ${distDir}:`);
  console.log(`- ${join(distDir, 'rss.xml')} (${feeds.rss.length} bytes)`);

  // Optional upload to GCS if GCS_BUCKET_NAME is set
  if (process.env.GCS_BUCKET_NAME) {
    console.log(`Uploading feed to GCS bucket: ${process.env.GCS_BUCKET_NAME}...`);
    const results = await uploadFeedsToGCS(feeds, process.env.GCS_BUCKET_NAME, {
      makePublic: process.env.GCS_MAKE_PUBLIC === 'true'
    });
    console.log('GCS Upload results:', results);
  }
}

main().catch((err) => {
  console.error('Fatal error during scrape:', err);
  process.exit(1);
});
