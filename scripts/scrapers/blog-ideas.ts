/**
 * Blog ideas scraper – fetches AI success stories and use cases from:
 * - Hacker News (top stories mentioning AI tools)
 * - Reddit r/artificial, r/ChatGPT, r/MachineLearning (via RSS)
 * - TechCrunch / VentureBeat AI RSS (use-case stories)
 *
 * Writes story candidates to data/blog-ideas.json.
 * Joan reviews weekly and picks which ones to turn into blog posts.
 */
import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'data', 'blog-ideas.json');

interface BlogIdea {
  title: string;
  url: string;
  source: string;
  summary: string;
  score?: number;         // HN score or Reddit upvotes if available
  fetchedAt: string;
}

// AI-related keywords to filter for relevant stories
const AI_KEYWORDS = [
  'chatgpt', 'claude', 'gpt', 'llm', 'ai tool', 'ai helped', 'ai saved',
  'cursor', 'copilot', 'midjourney', 'dall-e', 'stable diffusion',
  'automated', 'ai agent', 'ai workflow', 'ai use case', 'ai success',
  'elevenlabs', 'synthesia', 'heygen', 'descript', 'jasper', 'writesonic',
  'built with ai', 'using ai', 'ai startup', 'solo founder ai',
  'ai replaced', 'ai helped me', 'used ai to',
];

function containsAiKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some((kw) => lower.includes(kw));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Hacker News ────────────────────────────────────────────────────────────────
async function fetchHackerNews(): Promise<BlogIdea[]> {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids: number[] = await res.json();
    const top50 = ids.slice(0, 50);

    const items = await Promise.allSettled(
      top50.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.json();
      })
    );

    const ideas: BlogIdea[] = [];
    for (const result of items) {
      if (result.status !== 'fulfilled') continue;
      const item = result.value;
      if (!item || item.type !== 'story' || !item.title) continue;
      if (!containsAiKeyword(item.title + ' ' + (item.text ?? ''))) continue;

      ideas.push({
        title: item.title,
        url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        source: 'Hacker News',
        summary: (item.text ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
        score: item.score,
        fetchedAt: new Date().toISOString(),
      });
    }

    console.log(`HN: found ${ideas.length} relevant stories`);
    return ideas;
  } catch (err) {
    console.error(`Hacker News fetch failed: ${err}`);
    return [];
  }
}

// ── Reddit via RSS ─────────────────────────────────────────────────────────────
const REDDIT_FEEDS = [
  { url: 'https://www.reddit.com/r/artificial/top/.rss?t=day&limit=25', source: 'Reddit r/artificial' },
  { url: 'https://www.reddit.com/r/ChatGPT/top/.rss?t=day&limit=25', source: 'Reddit r/ChatGPT' },
  { url: 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day&limit=25', source: 'Reddit r/MachineLearning' },
  { url: 'https://www.reddit.com/r/SideProject/top/.rss?t=day&limit=25', source: 'Reddit r/SideProject' },
];

async function fetchRedditFeed(feedUrl: string, sourceName: string): Promise<BlogIdea[]> {
  try {
    const Parser = (await import('rss-parser')).default;
    const parser = new Parser({ timeout: 10000 });
    const feed = await parser.parseURL(feedUrl);

    const ideas: BlogIdea[] = [];
    for (const item of (feed.items ?? []).slice(0, 25)) {
      const text = (item.title ?? '') + ' ' + (item.contentSnippet ?? '');
      if (!containsAiKeyword(text)) continue;

      ideas.push({
        title: item.title ?? '',
        url: item.link ?? '',
        source: sourceName,
        summary: (item.contentSnippet ?? '').slice(0, 300),
        fetchedAt: new Date().toISOString(),
      });
    }

    console.log(`${sourceName}: found ${ideas.length} relevant stories`);
    return ideas;
  } catch (err) {
    console.error(`Reddit feed ${feedUrl} failed: ${err}`);
    return [];
  }
}

// ── Tech news RSS ──────────────────────────────────────────────────────────────
const TECH_NEWS_FEEDS = [
  { url: 'https://techcrunch.com/tag/artificial-intelligence/feed/', source: 'TechCrunch AI' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat AI' },
];

async function fetchTechNewsFeed(feedUrl: string, sourceName: string): Promise<BlogIdea[]> {
  try {
    const Parser = (await import('rss-parser')).default;
    const parser = new Parser({ timeout: 10000 });
    const feed = await parser.parseURL(feedUrl);

    // For tech news, take top 5 items — they're AI-focused feeds already
    return (feed.items ?? []).slice(0, 5).map((item) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      source: sourceName,
      summary: (item.contentSnippet ?? '').slice(0, 300),
      fetchedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error(`Tech news feed ${feedUrl} failed: ${err}`);
    return [];
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching blog ideas from HN, Reddit, and tech news...');

  // Load existing ideas to avoid duplicates
  let existing: BlogIdea[] = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    } catch {
      existing = [];
    }
  }
  const existingUrls = new Set(existing.map((i) => i.url));

  const results = await Promise.allSettled([
    withTimeout(fetchHackerNews(), 20000),
    ...REDDIT_FEEDS.map(({ url, source }) =>
      withTimeout(fetchRedditFeed(url, source), 15000)
    ),
    ...TECH_NEWS_FEEDS.map(({ url, source }) =>
      withTimeout(fetchTechNewsFeed(url, source), 15000)
    ),
  ]);

  const fresh: BlogIdea[] = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : []
  );

  // Deduplicate and merge with existing (keep newest 100 total)
  const newItems = fresh.filter((i) => i.url && !existingUrls.has(i.url));
  const merged = [...newItems, ...existing];

  // Sort by score desc (HN), then by fetch date
  merged.sort((a, b) => {
    if (a.score !== undefined && b.score !== undefined) return b.score - a.score;
    if (a.score !== undefined) return -1;
    if (b.score !== undefined) return 1;
    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime();
  });

  const trimmed = merged.slice(0, 100);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(trimmed, null, 2));
  console.log(`Saved ${trimmed.length} blog ideas (${newItems.length} new).`);
}

main().catch(console.error).finally(() => process.exit(0));
