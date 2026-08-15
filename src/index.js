import http from 'node:http';
import { fetchBlogPosts } from './scraper.js';
import { buildFeeds } from './feed-builder.js';
import { uploadFeedsToGCS } from './gcs-uploader.js';

const PORT = process.env.PORT || 8080;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const FEED_BASE_URL = process.env.FEED_BASE_URL || (GCS_BUCKET_NAME ? `https://storage.googleapis.com/${GCS_BUCKET_NAME}` : 'https://antigravity.google/blog');

let cachedFeeds = null;
let lastScrapedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes in-memory cache

/**
 * Runs the scrape and feed generation pipeline.
 * @param {{force?: boolean}} options
 * @returns {Promise<{feeds: {rss: string}, postCount: number, gcsUploads?: Array<object>}>}
 */
export async function runPipeline(options = {}) {
  const now = Date.now();
  if (!options.force && cachedFeeds && (now - lastScrapedAt < CACHE_TTL_MS)) {
    return { feeds: cachedFeeds, postCount: cachedFeeds.postCount, fromCache: true };
  }

  const posts = await fetchBlogPosts({ fetchFullContent: true, maxPosts: 50 });
  const feeds = buildFeeds(posts, { feedBaseUrl: FEED_BASE_URL });

  cachedFeeds = { ...feeds, postCount: posts.length };
  lastScrapedAt = now;

  let gcsUploads = null;
  if (GCS_BUCKET_NAME) {
    gcsUploads = await uploadFeedsToGCS(feeds, GCS_BUCKET_NAME, {
      makePublic: process.env.GCS_MAKE_PUBLIC === 'true'
    });
  }

  return {
    feeds,
    postCount: posts.length,
    gcsUploads,
    fromCache: false
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/healthz' || pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    }

    if (pathname === '/scrape' && (req.method === 'POST' || req.method === 'GET')) {
      const result = await runPipeline({ force: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        postCount: result.postCount,
        gcsUploads: result.gcsUploads,
        timestamp: new Date().toISOString()
      }));
    }

    if (pathname === '/rss.xml' || pathname === '/feed.xml') {
      const result = await runPipeline();
      res.writeHead(200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=14400, s-maxage=14400'
      });
      return res.end(result.feeds.rss);
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Google Antigravity Blog RSS Generator\n\nEndpoints:\n- /rss.xml or /feed.xml (RSS 2.0)\n- /scrape (Trigger scrape & GCS upload)\n- /healthz (Health Check)\n');
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    console.error('Request error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Antigravity RSS generator server listening on port ${PORT}`);
});
