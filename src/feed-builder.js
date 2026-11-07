import { Feed } from 'feed';
import { cleanTitle } from './scraper.js';

/**
 * Creates a Feed instance populated with posts.
 * @param {Array<object>} posts
 * @param {{feedBaseUrl?: string}} options
 * @returns {Feed}
 */
export function createFeedInstance(posts, options = {}) {
  const feedBaseUrl = options.feedBaseUrl || 'https://antigravity.google/blog';
  const latestDate = posts.length > 0 && posts[0].date ? posts[0].date : new Date();

  const feed = new Feed({
    title: 'Google Antigravity Blog',
    description: 'Stay up to date with the latest from the Google Antigravity team.',
    id: 'https://antigravity.google/blog',
    link: 'https://antigravity.google/blog',
    language: 'en',
    image: 'https://antigravity.google/assets/image/antigravity-logo.png',
    favicon: 'https://antigravity.google/favicon.ico',
    copyright: `All rights reserved ${new Date().getFullYear()}, Google LLC`,
    updated: latestDate,
    generator: 'agy-blog-rss',
    feedLinks: {
      rss2: `${feedBaseUrl}/rss.xml`,
      atom: `${feedBaseUrl}/atom.xml`,
      json: `${feedBaseUrl}/feed.json`,
    },
    author: {
      name: 'Google Antigravity Team',
      link: 'https://antigravity.google',
    },
  });

  for (const post of posts) {
    const title = cleanTitle(post.title);
    feed.addItem({
      title,
      id: post.url,
      link: post.url,
      description: post.summary || title,
      content: post.contentHtml || `<p>${post.summary || title}</p>`,
      author: [{ name: post.author || 'Google Antigravity Team', link: 'https://antigravity.google' }],
      date: post.date instanceof Date && !isNaN(post.date.getTime()) ? post.date : new Date(),
      image: post.image || undefined,
      category: post.category ? [{ name: post.category }] : [],
    });
  }

  return feed;
}

/**
 * Builds an RSS 2.0 feed XML string from a list of scraped posts.
 * @param {Array<object>} posts
 * @param {{feedBaseUrl?: string}} options
 * @returns {string} RSS 2.0 XML
 */
export function buildFeed(posts, options = {}) {
  return createFeedInstance(posts, options).rss2();
}
