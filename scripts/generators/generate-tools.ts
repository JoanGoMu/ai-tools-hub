/**
 * Automated tool page generator for AIToolCrunch.
 *
 * Sources new AI tool candidates from data/rss-feed-items.json
 * (the "Product Hunt AI" and "Product Hunt Productivity" entries are tool launches).
 * Uses Claude Haiku to generate full tool JSON, saved as status "active".
 *
 * Tools are published immediately as active. The comparison generator will create
 * comparison pages for them on the next daily run.
 *
 * Requires: ANTHROPIC_API_KEY env var
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ── Constants ──────────────────────────────────────────────────────────────────

const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const RSS_FILE = path.join(process.cwd(), 'data', 'rss-feed-items.json');
const GENERATED_TOOL_URLS_FILE = path.join(process.cwd(), 'data', 'tool-generated-urls.json');
const BOT_LOG_LATEST = path.join(process.cwd(), 'data', 'bot-log-latest.txt');
const BOT_LOG_ALL = path.join(process.cwd(), 'data', 'bot-log.txt');

const MAX_TOOLS_PER_RUN = 2;
const FRESHNESS_DAYS = 7;

const VALID_CATEGORIES = [
  'ai-writing', 'ai-image', 'ai-code', 'ai-video', 'ai-audio', 'ai-automation',
];

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet: string;
}

interface GeneratedTool {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string[];
  url: string;
  affiliateUrl: null;
  affiliateProgram: null;
  pricing: {
    hasFree: boolean;
    startingPrice: string | null;
    plans: { name: string; price: string; billingCycle: string; features: string[] }[];
  };
  features: string[];
  pros: string[];
  cons: string[];
  rating: number;
  logoUrl: string;
  screenshotUrl: null;
  lastUpdated: string;
  source: 'scraped';
  status: 'active';
  featured: false;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function parseJsonFromResponse(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  if (cleaned === 'null') return null;
  return JSON.parse(cleaned);
}

function appendBotLog(line: string): void {
  const dated = `[${getToday()}] ${line}`;
  fs.appendFileSync(BOT_LOG_LATEST, line + '\n');
  const existing = fs.existsSync(BOT_LOG_ALL) ? fs.readFileSync(BOT_LOG_ALL, 'utf-8') : '';
  fs.writeFileSync(BOT_LOG_ALL, dated + '\n' + existing);
}

function loadRssItems(): RssItem[] {
  if (!fs.existsSync(RSS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RSS_FILE, 'utf-8'));
  } catch { return []; }
}

function loadGeneratedToolUrls(): Set<string> {
  if (!fs.existsSync(GENERATED_TOOL_URLS_FILE)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(GENERATED_TOOL_URLS_FILE, 'utf-8')));
  } catch { return new Set(); }
}

function saveGeneratedToolUrls(urls: Set<string>): void {
  fs.writeFileSync(GENERATED_TOOL_URLS_FILE, JSON.stringify([...urls], null, 2));
}

function getExistingToolSlugs(): Set<string> {
  if (!fs.existsSync(TOOLS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(TOOLS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  );
}

function getExistingToolNames(): Set<string> {
  if (!fs.existsSync(TOOLS_DIR)) return new Set();
  const names = new Set<string>();
  for (const f of fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const tool = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
      if (tool.name) names.add(tool.name.toLowerCase());
    } catch { /* skip */ }
  }
  return names;
}

// ── API call ───────────────────────────────────────────────────────────────────

async function generateTool(
  client: Anthropic,
  item: RssItem,
): Promise<GeneratedTool | null> {
  const today = getToday();

  const systemPrompt = `You are a content editor for AIToolCrunch, an AI tools review site covering 6 categories: ai-writing, ai-image, ai-code, ai-video, ai-audio, ai-automation.

Given a Product Hunt tool listing, generate a complete tool JSON entry. Only generate a tool if it clearly fits one of these 6 categories. Return exactly the word null (no JSON, no quotes, just: null) if it does not fit.

Return ONLY valid JSON with no markdown fences:
{
  "slug": "canonical-tool-name (lowercase, hyphenated, the real product name - no PH suffixes like -3 or -2)",
  "name": "Display Name",
  "tagline": "Short one-line description under 60 characters",
  "description": "2-3 paragraph description. What it does, who it is for, key strengths. No em dashes. No leading spaces. No exclamation marks.",
  "category": ["ai-code"],
  "url": "https://actual-tool-website.com/ (the REAL website URL, NOT the Product Hunt URL)",
  "affiliateUrl": null,
  "affiliateProgram": null,
  "pricing": {
    "hasFree": true,
    "startingPrice": "$20/mo",
    "plans": [
      { "name": "Free", "price": "$0", "billingCycle": "forever", "features": ["Basic features"] },
      { "name": "Pro", "price": "$20/mo", "billingCycle": "monthly", "features": ["Advanced features"] }
    ]
  },
  "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2"],
  "rating": 4.2,
  "logoUrl": "/images/tools/SLUG.png",
  "screenshotUrl": null,
  "lastUpdated": "${today}",
  "source": "scraped",
  "status": "active",
  "featured": false
}

Rules:
- status MUST always be "active"
- rating: 3.8-4.5 range, be conservative for unknown tools
- If pricing is unknown, use hasFree: true, startingPrice: null, plans: [{ "name": "Unknown", "price": "See website", "billingCycle": "unknown", "features": [] }]
- description: no em dashes (use hyphen), no leading spaces, no exclamation marks
- slug: canonical product name only (e.g. "cursor" not "cursor-3", "grok" not "grok-voice-api")
- logoUrl: always "/images/tools/SLUG.png"
- Valid categories: ${VALID_CATEGORIES.join(', ')}`;

  const userPrompt = `Product Hunt listing:
Title: ${item.title}
Product Hunt URL: ${item.link}
Published: ${item.pubDate}

Generate the tool JSON entry, or return null if this tool does not fit the site's 6 AI categories.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const result = parseJsonFromResponse(text);
    if (result === null) return null;
    return result as GeneratedTool;
  } catch (err) {
    console.error(`Generation failed for "${item.title}": ${err}`);
    return null;
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateTool(
  tool: GeneratedTool,
  existingSlugs: Set<string>,
  existingNames: Set<string>,
): GeneratedTool | null {
  if (!tool.slug || !/^[a-z0-9-]+$/.test(tool.slug)) {
    console.error(`Invalid slug: "${tool.slug}"`);
    return null;
  }
  if (existingSlugs.has(tool.slug)) {
    console.log(`Tool already exists (slug): ${tool.slug}`);
    return null;
  }
  if (existingNames.has(tool.name?.toLowerCase())) {
    console.log(`Tool already exists (name): ${tool.name}`);
    return null;
  }
  if (!tool.name || !tool.description || !tool.url) {
    console.error(`Missing required fields for: ${tool.slug}`);
    return null;
  }
  // Reject if url is still a PH URL
  if (tool.url.includes('producthunt.com')) {
    console.error(`Tool URL is still a Product Hunt URL for: ${tool.slug}`);
    return null;
  }
  if (!tool.category || tool.category.length === 0 ||
      !tool.category.every(c => VALID_CATEGORIES.includes(c))) {
    console.error(`Invalid category for: ${tool.slug} - ${JSON.stringify(tool.category)}`);
    return null;
  }

  // Force active and clean content
  tool.status = 'active';
  tool.description = tool.description.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  tool.logoUrl = `/images/tools/${tool.slug}.png`;

  return tool;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set, skipping tool generation.');
    process.exit(0);
  }

  const allItems = loadRssItems();
  const generatedUrls = loadGeneratedToolUrls();
  const existingSlugs = getExistingToolSlugs();
  const existingNames = getExistingToolNames();

  // Filter to Product Hunt AI items only, fresh, not already processed
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FRESHNESS_DAYS);

  const candidates = allItems.filter(item =>
    item.source.startsWith('Product Hunt') &&
    new Date(item.pubDate) > cutoff &&
    !generatedUrls.has(item.link)
  );

  console.log(`${candidates.length} fresh Product Hunt candidates for tool generation`);

  if (candidates.length === 0) {
    console.log('No candidates. Skipping tool generation.');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  let generated = 0;

  for (const item of candidates) {
    if (generated >= MAX_TOOLS_PER_RUN) break;

    console.log(`Generating tool for: "${item.title}"...`);

    const raw = await generateTool(client, item);

    // Always mark this URL as processed regardless of outcome
    generatedUrls.add(item.link);

    if (!raw) {
      console.log(`  -> Skipped (not a fit for site categories)`);
      continue;
    }

    const validated = validateTool(raw, existingSlugs, existingNames);
    if (!validated) continue;

    const outPath = path.join(TOOLS_DIR, `${validated.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(validated, null, 2));
    existingSlugs.add(validated.slug);
    existingNames.add(validated.name.toLowerCase());

    appendBotLog(`tool: ${validated.name} -> https://aitoolcrunch.com/tools/${validated.slug}`);

    console.log(`Wrote: data/tools/${validated.slug}.json (active - live on next deploy)`);
    generated++;
  }

  saveGeneratedToolUrls(generatedUrls);
  console.log(`Done. Generated ${generated} tool(s).`);
}

main().catch(console.error).finally(() => process.exit(0));
