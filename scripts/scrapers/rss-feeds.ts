/**
 * RSS feed scraper – reads AI tool news from tech blogs.
 * Writes article summaries to data/rss-feed-items.json.
 * Used for the news/blog section (future feature).
 */
import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'data', 'rss-feed-items.json');

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet: string;
}

const AI_RSS_FEEDS = [
  { url: 'https://techcrunch.com/tag/artificial-intelligence/feed/', source: 'TechCrunch AI' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat AI' },
  { url: 'https://www.producthunt.com/feed?category=artificial-intelligence', source: 'Product Hunt AI' },
  { url: 'https://www.producthunt.com/feed?category=productivity', source: 'Product Hunt Productivity' },
];

async function parseFeed(feedUrl: string, sourceName: string): Promise<FeedItem[]> {
  try {
    // Dynamic import to avoid bundling issues
    const Parser = (await import('rss-parser')).default;
    const parser = new Parser({ timeout: 10000 });
    const feed = await parser.parseURL(feedUrl);

    return (feed.items ?? []).slice(0, 10).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      pubDate: item.pubDate ?? new Date().toISOString(),
      source: sourceName,
      snippet: (item.contentSnippet ?? item.content ?? '').slice(0, 200),
    }));
  } catch (err) {
    console.error(`Failed to parse feed ${feedUrl}: ${err}`);
    return [];
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

async function main() {
  console.log('Fetching RSS feeds...');

  const results = await Promise.allSettled(
    AI_RSS_FEEDS.map(({ url, source }) => withTimeout(parseFeed(url, source), 15000))
  );

  const items: FeedItem[] = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  // Deduplicate by link
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  // Sort by date, newest first
  unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Keep the latest 50 items
  const trimmed = unique.slice(0, 50);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(trimmed, null, 2));

  console.log(`Saved ${trimmed.length} RSS items from ${AI_RSS_FEEDS.length} feeds.`);
}

main().catch(console.error);
