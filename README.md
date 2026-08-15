# Google Antigravity Blog RSS Generator

A lightweight, serverless RSS 2.0 feed generator for the [Google Antigravity Blog](https://antigravity.google/blog).

## Public Feed URL
- **Static GCS CDN URL**: `https://storage.googleapis.com/antigravity-blog-feed-airy-rock-454920-i5/rss.xml`
- **Cloud Run Direct URL**: `https://agy-blog-rss-grnezkrt2q-ma.a.run.app/rss.xml` (or `/feed.xml`)

## Features
- **Deterministic DOM Extraction**: Cheerio-based extraction of titles, slugs, publish dates, hero media, authors, and full article HTML bodies.
- **Standards Compliant**: Valid RSS 2.0 XML with enclosures and full post content.
- **GCP Serverless**: Cloud Run (`europe-north2`) triggered every 4 hours (`15 */4 * * *`) via Cloud Scheduler (`europe-west1`), publishing directly to a public Google Cloud Storage bucket.

## Usage

### Local Scrape
```bash
npm install
npm run scrape
```
Outputs to `./dist/rss.xml`.

### Local Server
```bash
npm start
```
Available on `http://localhost:8080/rss.xml`.

### Run Tests
```bash
npm test
```
