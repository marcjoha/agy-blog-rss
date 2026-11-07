# Google Antigravity Blog RSS & Atom Feeds

An unofficial, auto-updating RSS 2.0, Atom 1.0, and JSON Feed for the [Google Antigravity Blog](https://antigravity.google/blog).

## Feed URLs

If you're just here to subscribe in your feed reader (Feedly, NetNewsWire, Reeder, Inoreader, etc.), choose your preferred feed format:

- **RSS 2.0**: `https://storage.googleapis.com/antigravity-blog-feed/rss.xml`
- **Atom 1.0**: `https://storage.googleapis.com/antigravity-blog-feed/atom.xml`
- **JSON Feed 1.0**: `https://storage.googleapis.com/antigravity-blog-feed/feed.json`

The feeds include full article HTML, hero media, publication dates, and tags, updated every 2 hours.

---

## How It Works

- **Scraper**: A lightweight Node.js worker extracts articles directly from the blog DOM.
- **Hosting**: Served as static files from Google Cloud Storage with CDN caching.
- **Automation**: Triggered on schedule via Google Cloud Scheduler and Google Cloud Run.

## Development

### Local Scrape
```bash
npm install
npm run scrape
```
Outputs the generated feeds to `./dist/rss.xml`, `./dist/atom.xml`, and `./dist/feed.json`.

### Run Tests
```bash
npm test
```
