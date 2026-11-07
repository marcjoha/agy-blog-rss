import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, toAbsoluteUrl, parseBlogIndex, parsePostContent, cleanTitle } from '../src/scraper.js';
import { buildFeed, createFeedInstance } from '../src/feed-builder.js';

test('cleanTitle strips prefix and suffix accurately', () => {
  assert.equal(cleanTitle('Antigravity Anywhere with Remote Control | Google Antigravity Blog'), 'Antigravity Anywhere with Remote Control');
  assert.equal(cleanTitle('Google Antigravity Blog: Custom Agents Deep Dive'), 'Custom Agents Deep Dive');
  assert.equal(cleanTitle('Gemini 3.7 Flash in Google Antigravity'), 'Gemini 3.7 Flash in Google Antigravity');
  assert.equal(cleanTitle(''), '');
  assert.equal(cleanTitle(null), '');
});

test('parseDate handles valid and invalid date formats', () => {
  const d1 = parseDate('13 Aug 2026');
  assert.equal(d1.getUTCFullYear(), 2026);
  assert.equal(d1.getUTCMonth(), 7);
  assert.equal(d1.getUTCDate(), 13);

  const d2 = parseDate('2026-05-19');
  assert.equal(d2.getUTCFullYear(), 2026);
  assert.equal(d2.getUTCMonth(), 4);

  const dFallback = parseDate('');
  assert.ok(dFallback instanceof Date);
});

test('toAbsoluteUrl converts relative paths correctly', () => {
  assert.equal(toAbsoluteUrl('/blog/my-post'), 'https://antigravity.google/blog/my-post');
  assert.equal(toAbsoluteUrl('assets/image.png'), 'https://antigravity.google/assets/image.png');
  assert.equal(toAbsoluteUrl('https://other.domain/test'), 'https://other.domain/test');
  assert.equal(toAbsoluteUrl(''), '');
});

test('parseBlogIndex extracts featured and standard article cards', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="featured-article-content">
          <p class="featured-label">Featured</p>
          <a href="/blog/featured-item" class="featured-title-link">
            <h2 class="featured-title">Featured Antigravity Post | Google Antigravity Blog</h2>
          </a>
          <div class="tags-section">
            <span class="caption">13 Aug 2026</span>
            <span class="caption">Model</span>
          </div>
          <video src="/assets/video/loop.mp4"></video>
        </div>

        <div class="card-wrapper" data-card-tags="[&quot;Product&quot;]">
          <div class="featured-card">
            <a href="/blog/standard-item" class="card-title-link">
              <h3 class="heading-6">Standard Post Title</h3>
            </a>
            <div class="tags-section">
              <span class="caption">12 Aug 2026</span>
              <span class="caption">Product</span>
            </div>
            <img src="/assets/image/standard.png" alt="standard">
          </div>
        </div>
      </body>
    </html>
  `;

  const posts = parseBlogIndex(sampleHtml);
  assert.equal(posts.length, 2);

  assert.equal(posts[0].title, 'Featured Antigravity Post');
  assert.equal(posts[0].url, 'https://antigravity.google/blog/featured-item');
  assert.equal(posts[0].slug, 'featured-item');
  assert.equal(posts[0].category, 'Model');
  assert.equal(posts[0].media, 'https://antigravity.google/assets/video/loop.mp4');

  assert.equal(posts[1].title, 'Standard Post Title');
  assert.equal(posts[1].url, 'https://antigravity.google/blog/standard-item');
  assert.equal(posts[1].slug, 'standard-item');
  assert.equal(posts[1].category, 'Product');
  assert.equal(posts[1].media, 'https://antigravity.google/assets/image/standard.png');
});

test('parsePostContent extracts body, author, and description with absolute URLs', () => {
  const samplePostHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:title" content="Custom Agents Deep Dive | Google Antigravity Blog">
        <meta property="og:description" content="A comprehensive look into custom agents.">
        <meta property="og:image" content="/assets/image/hero.png">
      </head>
      <body>
        <div class="header-author">Antigravity Team</div>
        <div class="content-section">
          <p>Introductory paragraph with a <a href="/docs/custom-agents">link</a>.</p>
          <img src="/assets/image/diagram.png" alt="Diagram">
          <h2>Section 1</h2>
          <p>Another paragraph.</p>
        </div>
      </body>
    </html>
  `;

  const details = parsePostContent(samplePostHtml);
  assert.equal(details.title, 'Custom Agents Deep Dive');
  assert.equal(details.summary, 'A comprehensive look into custom agents.');
  assert.equal(details.author, 'Antigravity Team');
  assert.equal(details.image, 'https://antigravity.google/assets/image/hero.png');
  assert.ok(details.contentHtml.includes('https://antigravity.google/docs/custom-agents'));
  assert.ok(details.contentHtml.includes('https://antigravity.google/assets/image/diagram.png'));
});

test('buildFeed and createFeedInstance generate valid RSS, Atom, and JSON feeds', () => {
  const mockPosts = [
    {
      title: 'Test Post 1',
      url: 'https://antigravity.google/blog/test-post-1',
      slug: 'test-post-1',
      summary: 'Summary of test post 1',
      contentHtml: '<p>Full content of test post 1</p>',
      author: 'Google Antigravity Team',
      date: new Date('2026-08-13T12:00:00Z'),
      category: 'Model',
      image: 'https://antigravity.google/assets/image/test.png',
    },
  ];

  const feed = createFeedInstance(mockPosts, { feedBaseUrl: 'https://storage.googleapis.com/test-bucket' });
  const rss = feed.rss2();
  const atom = feed.atom1();
  const jsonFeed = feed.json1();

  assert.ok(rss.includes('<rss version="2.0"'));
  assert.ok(rss.includes('<title>Google Antigravity Blog</title>'));
  assert.ok(rss.includes('<title><![CDATA[Test Post 1]]></title>'));
  assert.ok(rss.includes('https://antigravity.google/blog/test-post-1'));
  assert.ok(rss.includes('<description><![CDATA[Summary of test post 1]]></description>'));

  assert.ok(atom.includes('<feed xmlns="http://www.w3.org/2005/Atom"'));
  assert.ok(atom.includes('<title>Google Antigravity Blog</title>'));
  assert.ok(atom.includes('https://antigravity.google/blog/test-post-1'));

  const parsedJson = JSON.parse(jsonFeed);
  assert.equal(parsedJson.title, 'Google Antigravity Blog');
  assert.equal(parsedJson.items.length, 1);
  assert.equal(parsedJson.items[0].title, 'Test Post 1');

  // Also verify legacy buildFeed helper
  const rssLegacy = buildFeed(mockPosts, { feedBaseUrl: 'https://storage.googleapis.com/test-bucket' });
  assert.equal(rssLegacy, rss);
});
