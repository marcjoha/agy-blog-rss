import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { config } from './config.js';
import { fetchBlogPosts } from './scraper.js';
import { buildFeed } from './feed-builder.js';
import { uploadFeed } from './gcs-uploader.js';

async function main() {
  console.log('Fetching Google Antigravity blog posts...');
  const startTime = Date.now();

  const posts = await fetchBlogPosts({ fetchFullContent: true, maxPosts: 50 });
  console.log(`Scraped ${posts.length} posts in ${Date.now() - startTime}ms.`);

  const rss = buildFeed(posts, { feedBaseUrl: config.feedBaseUrl });

  const distDir = resolve(process.cwd(), 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, 'rss.xml'), rss, 'utf-8');
  console.log(`Written ${join(distDir, 'rss.xml')} (${rss.length} bytes)`);

  if (config.gcsBucketName) {
    console.log(`Uploading to gs://${config.gcsBucketName}...`);
    const result = await uploadFeed(rss, config.gcsBucketName);
    console.log(`Uploaded: ${result.publicUrl}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
