import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { config } from './config.js';
import { fetchBlogPosts } from './scraper.js';
import { createFeedInstance } from './feed-builder.js';
import { uploadFeeds } from './gcs-uploader.js';

async function main() {
  console.log('Fetching Google Antigravity blog posts...');
  const startTime = Date.now();

  const posts = await fetchBlogPosts({ fetchFullContent: true, maxPosts: 50 });
  console.log(`Scraped ${posts.length} posts in ${Date.now() - startTime}ms.`);

  const feed = createFeedInstance(posts, { feedBaseUrl: config.feedBaseUrl });
  const feeds = {
    rss: feed.rss2(),
    atom: feed.atom1(),
    json: feed.json1(),
  };

  const distDir = resolve(process.cwd(), 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, 'rss.xml'), feeds.rss, 'utf-8');
  await writeFile(join(distDir, 'atom.xml'), feeds.atom, 'utf-8');
  await writeFile(join(distDir, 'feed.json'), feeds.json, 'utf-8');
  console.log(`Written feeds to ${distDir}`);

  if (config.gcsBucketName) {
    console.log(`Uploading to gs://${config.gcsBucketName}...`);
    const results = await uploadFeeds(feeds, config.gcsBucketName);
    for (const item of results) {
      console.log(`Uploaded: ${item.publicUrl}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
