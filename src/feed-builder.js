import { Feed } from 'feed';

/**
 * Builds RSS 2.0 feed from a list of scraped posts.
 * @param {Array<object>} posts
 * @param {{feedBaseUrl?: string}} options
 * @returns {{rss: string}}
 */
export function buildFeeds(posts, options = {}) {
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
    generator: 'Google Antigravity RSS Feed Generator',
    feedLinks: {
      rss2: `${feedBaseUrl}/rss.xml`
    },
    author: {
      name: 'Google Antigravity Team',
      link: 'https://antigravity.google'
    }
  });

  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: post.url,
      link: post.url,
      description: post.summary || post.title,
      content: post.contentHtml || `<p>${post.summary || post.title}</p>`,
      author: [
        {
          name: post.author || 'Google Antigravity Team',
          link: 'https://antigravity.google'
        }
      ],
      date: post.date instanceof Date && !isNaN(post.date.getTime()) ? post.date : new Date(),
      image: post.image || undefined,
      category: post.category ? [{ name: post.category }] : []
    });
  }

  return {
    rss: feed.rss2()
  };
}
