# Google Antigravity Blog RSS Feed

An unofficial, auto-updating RSS 2.0 feed for the [Google Antigravity Blog](https://antigravity.google/blog).

## RSS Feed URL

If you're just here to subscribe in your feed reader (Feedly, NetNewsWire, Reeder, Inoreader, etc.), copy this URL:

```
https://storage.googleapis.com/antigravity-blog-feed-airy-rock-454920-i5/rss.xml
```

The feed includes full article HTML, hero media, publication dates, and tags, updated every 4 hours.

---

## How It Works

- **Scraper**: A lightweight Node.js worker extracts articles directly from the blog DOM.
- **Hosting**: Served as a static XML file from Google Cloud Storage with CDN caching.
- **Automation**: Triggered on schedule via Google Cloud Scheduler and Google Cloud Run.

## Development

### Local Scrape
```bash
npm install
npm run scrape
```
Outputs the generated XML to `./dist/rss.xml`.

### Run Tests
```bash
npm test
```
