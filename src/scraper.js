import * as cheerio from 'cheerio';

export const BASE_URL = 'https://antigravity.google';
export const BLOG_INDEX_URL = `${BASE_URL}/blog`;

const USER_AGENT = 'Antigravity-Blog-RSS-Generator/1.0 (+https://github.com/marcjoha/agy-blog-rss)';
const DATE_PATTERN = /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/;

/**
 * Parses human dates such as "13 Aug 2026" or ISO strings into a Date object.
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  const parsed = new Date(`${trimmed} 12:00:00 GMT`);
  if (!isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Ensures a URL or asset path is absolute.
 * @param {string} url
 * @returns {string}
 */
export function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Extracts date and category strings from caption spans within an element.
 * @param {import('cheerio').Cheerio} $el
 * @param {import('cheerio').CheerioAPI} $
 * @returns {{dateStr: string, category: string}}
 */
function extractCaptions($el, $) {
  let dateStr = '';
  let category = '';
  $el.find('[class*="caption"]').each((_, cap) => {
    const text = $(cap).text().trim();
    if (DATE_PATTERN.test(text)) {
      dateStr = text;
    } else if (text && !category) {
      category = text;
    }
  });
  return { dateStr, category };
}

/**
 * Builds a normalized post metadata object.
 * @param {{url: string, title: string, dateStr: string, category: string, mediaSrc: string}} fields
 * @returns {{title: string, url: string, slug: string, date: Date, category: string, media: string}}
 */
function buildPost({ url, title, dateStr, category, mediaSrc }) {
  return {
    title,
    url,
    slug: url.replace(`${BASE_URL}/blog/`, ''),
    date: parseDate(dateStr),
    category: category || 'General',
    media: mediaSrc ? toAbsoluteUrl(mediaSrc) : '',
  };
}

/**
 * Parses article metadata from the blog index HTML.
 * @param {string} html
 * @returns {Array<{title: string, url: string, slug: string, date: Date, category: string, media: string}>}
 */
export function parseBlogIndex(html) {
  const $ = cheerio.load(html);
  const postsMap = new Map();

  // 1. Featured article
  $('[class*="featured-article-content"], [class*="main-element"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a[href^="/blog/"]').first().attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;

    const title = $el.find('h1, h2, h3, [class*="featured-title"]').first().text().trim();
    if (!title) return;

    const fullUrl = toAbsoluteUrl(href);
    const { dateStr, category } = extractCaptions($el, $);
    const mediaSrc = $el.parent().find('video, img').attr('src');

    postsMap.set(fullUrl, buildPost({ url: fullUrl, title, dateStr, category, mediaSrc }));
  });

  // 2. Standard article cards
  $('[class*="card-wrapper"], [class*="featured-card"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a[href^="/blog/"]').first().attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;

    const title = $el.find('h2, h3, h4, [class*="heading-"]').first().text().trim();
    if (!title) return;

    const fullUrl = toAbsoluteUrl(href);
    if (postsMap.has(fullUrl)) return;

    const { dateStr, category } = extractCaptions($el, $);
    const mediaSrc = $el.find('img, video').attr('src');

    postsMap.set(fullUrl, buildPost({ url: fullUrl, title, dateStr, category, mediaSrc }));
  });

  // 3. Fallback: catch blog links missed by the above selectors
  $('a[href^="/blog/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;

    const fullUrl = toAbsoluteUrl(href);
    if (postsMap.has(fullUrl)) return;

    const text = $(el).text().trim();
    if (text && text.length > 5 && !['read blog', 'read more', 'learn more'].includes(text.toLowerCase())) {
      postsMap.set(fullUrl, buildPost({ url: fullUrl, title: text, dateStr: '', category: '', mediaSrc: '' }));
    }
  });

  return Array.from(postsMap.values());
}

/**
 * Parses full article body and metadata from an individual post page.
 * @param {string} html
 * @returns {{contentHtml: string, summary: string, author: string, image: string, title: string}}
 */
export function parsePostContent(html) {
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  const ogDescription = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const author = $('[class*="header-author"]').first().text().trim() || 'Google Antigravity Team';

  const contentSection = $('[class*="content-section"]').first();
  let contentHtml = '';
  if (contentSection.length > 0) {
    contentSection.find('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) $(el).attr('href', toAbsoluteUrl(href));
    });
    contentSection.find('img[src], video[src], source[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) $(el).attr('src', toAbsoluteUrl(src));
    });
    contentHtml = contentSection.html() || '';
  }

  let summary = ogDescription;
  if (!summary && contentSection.length > 0) {
    summary = contentSection.find('p').first().text().trim();
  }

  return {
    title: ogTitle.replace(/^Google Antigravity Blog:\s*/i, '').trim(),
    summary,
    contentHtml,
    author,
    image: ogImage ? toAbsoluteUrl(ogImage) : '',
  };
}

/**
 * Fetches all blog posts, optionally populating full article HTML.
 * Uses sequential fetching to avoid hammering the target server.
 * @param {{fetchFullContent?: boolean, maxPosts?: number}} options
 * @returns {Promise<Array<object>>}
 */
export async function fetchBlogPosts(options = {}) {
  const { fetchFullContent = true, maxPosts = 30 } = options;
  const headers = { 'User-Agent': USER_AGENT };

  const indexRes = await fetch(BLOG_INDEX_URL, { headers });
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch blog index: ${indexRes.status} ${indexRes.statusText}`);
  }

  const posts = parseBlogIndex(await indexRes.text()).slice(0, maxPosts);
  if (!fetchFullContent) return posts;

  const detailed = [];
  for (const post of posts) {
    try {
      const res = await fetch(post.url, { headers });
      if (!res.ok) {
        detailed.push(post);
        continue;
      }
      const details = parsePostContent(await res.text());
      detailed.push({
        ...post,
        title: details.title || post.title,
        summary: details.summary || post.title,
        contentHtml: details.contentHtml || `<p>${details.summary || post.title}</p>`,
        author: details.author,
        image: details.image || post.media,
      });
    } catch (err) {
      console.error(`Failed to fetch ${post.url}: ${err.message}`);
      detailed.push(post);
    }
  }

  return detailed;
}
