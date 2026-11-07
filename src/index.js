import http from 'node:http';
import { config } from './config.js';
import { fetchBlogPosts } from './scraper.js';
import { createFeedInstance } from './feed-builder.js';
import { uploadFeeds } from './gcs-uploader.js';

let cachedFeeds = null;
let cachedPostCount = 0;
let lastScrapedAt = 0;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Runs the scrape → build → upload pipeline.
 * @param {{force?: boolean}} options
 */
async function runPipeline(options = {}) {
  const now = Date.now();
  if (!options.force && cachedFeeds && (now - lastScrapedAt < CACHE_TTL_MS)) {
    return { feeds: cachedFeeds, postCount: cachedPostCount, fromCache: true };
  }

  const posts = await fetchBlogPosts({ fetchFullContent: true, maxPosts: 50 });
  const feed = createFeedInstance(posts, { feedBaseUrl: config.feedBaseUrl });
  const feeds = {
    rss: feed.rss2(),
    atom: feed.atom1(),
    json: feed.json1(),
  };

  cachedFeeds = feeds;
  cachedPostCount = posts.length;
  lastScrapedAt = now;

  let gcsUpload = null;
  if (config.gcsBucketName) {
    gcsUpload = await uploadFeeds(feeds, config.gcsBucketName);
  }

  return { feeds, postCount: posts.length, gcsUpload, fromCache: false };
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (pathname === '/healthz') {
      return json(res, 200, { status: 'ok' });
    }

    if (pathname === '/scrape' && req.method === 'POST') {
      const result = await runPipeline({ force: true });
      return json(res, 200, {
        success: true,
        postCount: result.postCount,
        gcsUpload: result.gcsUpload,
      });
    }

    if (pathname === '/rss.xml' || pathname === '/feed.xml') {
      const result = await runPipeline();
      res.writeHead(200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=7200, s-maxage=7200',
      });
      return res.end(result.feeds.rss);
    }

    if (pathname === '/atom.xml') {
      const result = await runPipeline();
      res.writeHead(200, {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=7200, s-maxage=7200',
      });
      return res.end(result.feeds.atom);
    }

    if (pathname === '/feed.json') {
      const result = await runPipeline();
      res.writeHead(200, {
        'Content-Type': 'application/feed+json; charset=utf-8',
        'Cache-Control': 'public, max-age=7200, s-maxage=7200',
      });
      return res.end(result.feeds.json);
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end([
        'Google Antigravity Blog RSS Generator',
        '',
        'Endpoints:',
        '  GET  /rss.xml   RSS 2.0 feed',
        '  GET  /atom.xml  Atom 1.0 feed',
        '  GET  /feed.json JSON Feed 1.0',
        '  POST /scrape    Trigger scrape & GCS upload',
        '  GET  /healthz   Health check',
        '',
      ].join('\n'));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message, stack: err.stack }));
    json(res, 500, { error: err.message });
  }
});

server.listen(config.port, () => {
  console.log(JSON.stringify({ severity: 'INFO', message: `Listening on port ${config.port}` }));
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({ severity: 'INFO', message: 'SIGTERM received, shutting down' }));
  server.close(() => process.exit(0));
});
