import * as cheerio from 'cheerio';

export const BASE_URL = 'https://antigravity.google';
export const BLOG_INDEX_URL = 'https://antigravity.google/blog';

/**
 * Parses human dates such as "13 Aug 2026" or ISO strings into a Date object.
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  const parsed = new Date(`${trimmed} 12:00:00 GMT`);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
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
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Parses article metadata from the blog index HTML.
 * @param {string} html
 * @returns {Array<{title: string, url: string, slug: string, date: Date, category: string, media: string}>}
 */
export function parseBlogIndex(html) {
  const $ = cheerio.load(html);
  const postsMap = new Map();

  // 1. Featured article parser
  $('[class*="featured-article-content"], [class*="main-element"]').each((_, el) => {
    const linkEl = $(el).find('a[href^="/blog/"], a[href*="/blog/"]').first();
    const href = linkEl.attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;

    const title = $(el).find('h1, h2, h3, [class*="featured-title"]').first().text().trim();
    if (!title) return;

    const fullUrl = toAbsoluteUrl(href);
    let dateStr = '';
    let category = '';

    $(el).find('[class*="caption"]').each((i, cap) => {
      const text = $(cap).text().trim();
      if (/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(text)) {
        dateStr = text;
      } else if (text && !category) {
        category = text;
      }
    });

    const mediaSrc = $(el).parent().find('video, img').attr('src');

    postsMap.set(fullUrl, {
      title,
      url: fullUrl,
      slug: fullUrl.replace(`${BASE_URL}/blog/`, ''),
      date: parseDate(dateStr),
      category: category || 'General',
      media: mediaSrc ? toAbsoluteUrl(mediaSrc) : ''
    });
  });

  // 2. Standard article cards
  $('[class*="card-wrapper"], [class*="featured-card"]').each((_, el) => {
    const linkEl = $(el).find('a[href^="/blog/"], a[href*="/blog/"]').first();
    const href = linkEl.attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;

    const title = $(el).find('h2, h3, h4, [class*="heading-"]').first().text().trim();
    if (!title) return;

    const fullUrl = toAbsoluteUrl(href);
    if (postsMap.has(fullUrl)) return;

    let dateStr = '';
    let category = '';

    $(el).find('[class*="caption"]').each((_, cap) => {
      const text = $(cap).text().trim();
      if (/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(text)) {
        dateStr = text;
      } else if (text && !category) {
        category = text;
      }
    });

    const mediaSrc = $(el).find('img, video').attr('src');

    postsMap.set(fullUrl, {
      title,
      url: fullUrl,
      slug: fullUrl.replace(`${BASE_URL}/blog/`, ''),
      date: parseDate(dateStr),
      category: category || 'General',
      media: mediaSrc ? toAbsoluteUrl(mediaSrc) : ''
    });
  });

  // 3. Fallback scanner for any blog links missed by card classes
  $('a[href^="/blog/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;

    const fullUrl = toAbsoluteUrl(href);
    if (!postsMap.has(fullUrl)) {
      const text = $(el).text().trim();
      if (text && text.length > 5 && !['read blog', 'read more', 'learn more'].includes(text.toLowerCase())) {
        postsMap.set(fullUrl, {
          title: text,
          url: fullUrl,
          slug: fullUrl.replace(`${BASE_URL}/blog/`, ''),
          date: new Date(),
          category: 'General',
          media: ''
        });
      }
    }
  });

  return Array.from(postsMap.values());
}

/**
 * Parses full article body and metadata from an individual post page.
 * @param {string} html
 * @param {string} postUrl
 * @returns {{contentHtml: string, summary: string, author: string, image: string, title?: string}}
 */
export function parsePostContent(html, postUrl) {
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  const ogDescription = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';

  const author = $('[class*="header-author"]').first().text().trim() || 'Google Antigravity Team';

  // Extract main article content
  const contentSection = $('[class*="content-section"]').first();

  let contentHtml = '';
  if (contentSection.length > 0) {
    // Convert relative URLs to absolute in content
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

  // Summary generation: first paragraph text or og:description
  let summary = ogDescription;
  if (!summary && contentSection.length > 0) {
    summary = contentSection.find('p').first().text().trim();
  }

  return {
    title: ogTitle.replace(/^Google Antigravity Blog:\s*/i, '').trim(),
    summary,
    contentHtml,
    author,
    image: ogImage ? toAbsoluteUrl(ogImage) : ''
  };
}

/**
 * Fetches all blog posts, optionally populating full article HTML.
 * @param {{fetchFullContent?: boolean, maxPosts?: number}} options
 * @returns {Promise<Array<object>>}
 */
export function fetchBlogPosts(options = {}) {
  const { fetchFullContent = true, maxPosts = 30 } = options;

  return fetch(BLOG_INDEX_URL, {
    headers: {
      'User-Agent': 'Antigravity-Blog-RSS-Generator/1.0 (+https://antigravity.google)'
    }
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch blog index: ${res.status} ${res.statusText}`);
      }
      return res.text();
    })
    .then(async (indexHtml) => {
      const posts = parseBlogIndex(indexHtml);
      const targetPosts = posts.slice(0, maxPosts);

      if (!fetchFullContent) {
        return targetPosts;
      }

      // Fetch full content for posts concurrently in batches
      const detailedPosts = await Promise.all(
        targetPosts.map(async (post) => {
          try {
            const postRes = await fetch(post.url, {
              headers: {
                'User-Agent': 'Antigravity-Blog-RSS-Generator/1.0 (+https://antigravity.google)'
              }
            });
            if (!postRes.ok) {
              return post;
            }
            const postHtml = await postRes.text();
            const details = parsePostContent(postHtml, post.url);

            return {
              ...post,
              title: details.title || post.title,
              summary: details.summary || post.title,
              contentHtml: details.contentHtml || `<p>${details.summary || post.title}</p>`,
              author: details.author,
              image: details.image || post.media
            };
          } catch (err) {
            console.error(`Failed to fetch details for ${post.url}:`, err.message);
            return post;
          }
        })
      );

      return detailedPosts;
    });
}
