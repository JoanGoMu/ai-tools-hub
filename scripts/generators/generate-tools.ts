/**
 * Automated tool page generator for AIToolCrunch.
 *
 * Reads data/scraped-suggestions.json (populated by the Product Hunt scraper),
 * uses Claude Haiku to generate full tool JSON for promising new AI tools,
 * then writes them to data/tools/{slug}.json with status "draft".
 *
 * New tools are drafts - you must manually set status to "active" to publish.
 * Once active, the comparison generator automatically creates comparison pages.
 *
 * Requires: ANTHROPIC_API_KEY env var
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ── Constants ──────────────────────────────────────────────────────────────────

const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const SUGGESTIONS_FILE = path.join(process.cwd(), 'data', 'scraped-suggestions.json');
const BOT_LOG_FILE = '/tmp/bot-log.txt';

const MAX_TOOLS_PER_RUN = 2;
const MIN_VOTES = 50; // Only consider PH tools with enough traction

const VALID_CATEGORIES = [
  'ai-writing', 'ai-image', 'ai-code', 'ai-video', 'ai-audio', 'ai-automation',
];

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface PHPost {
  slug: string;
  name: string;
  tagline: string;
  url: string;
  topics: { name: string }[];
  votesCount: number;
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
  status: 'draft';
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
  fs.appendFileSync(BOT_LOG_FILE, line + '\n');
}

function loadSuggestions(): PHPost[] {
  if (!fs.existsSync(SUGGESTIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf-8'));
  } catch { return []; }
}

function getExistingToolSlugs(): Set<string> {
  if (!fs.existsSync(TOOLS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(TOOLS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  );
}

// ── API call ───────────────────────────────────────────────────────────────────

async function generateTool(
  client: Anthropic,
  suggestion: PHPost,
): Promise<GeneratedTool | null> {
  const today = getToday();

  const systemPrompt = `You are a content editor for AIToolCrunch, an AI tools review site covering 6 categories: ai-writing, ai-image, ai-code, ai-video, ai-audio, ai-automation.

Given a Product Hunt tool suggestion, generate a complete tool JSON entry. Only generate a tool if it clearly fits one of these 6 categories. Return exactly null (not JSON null, just the word null) if it doesn't fit.

Return ONLY valid JSON with no markdown fences:
{
  "slug": "canonical-tool-name (lowercase, hyphenated, NO number suffixes like -3 or -2)",
  "name": "Display Name",
  "tagline": "Short one-line description under 60 characters",
  "description": "2-3 paragraph description - what it does, who it is for, key strengths. No em dashes. No leading spaces.",
  "category": ["ai-code"],
  "url": "https://actual-tool-website.com/ (the real website, NOT the Product Hunt URL)",
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
  "status": "draft",
  "featured": false
}

Rules:
- status is ALWAYS "draft" - never change this
- rating: 3.8-4.5 range (be conservative for unknown tools)
- If pricing is uncertain, use hasFree: true and startingPrice: null with a single "Unknown" plan
- description: no em dashes (use hyphen), no leading spaces, no exclamation marks
- category: array, can include multiple if the tool genuinely spans categories
- slug: use the canonical well-known name (e.g. "cursor" not "cursor-3", "chatgpt" not "chat-gpt-4")
- logoUrl: always "/images/tools/SLUG.png" where SLUG matches the slug field
- Valid categories: ${VALID_CATEGORIES.join(', ')}`;

  const userPrompt = `Product Hunt suggestion:
Name: ${suggestion.name}
Tagline: ${suggestion.tagline}
Product Hunt URL: ${suggestion.url}
Votes: ${suggestion.votesCount}
Topics: ${suggestion.topics.map(t => t.name).join(', ')}

Generate the tool JSON, or return null if this tool doesn't fit the site's 6 AI categories.`;

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
    console.error(`Generation failed for "${suggestion.name}": ${err}`);
    return null;
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateTool(tool: GeneratedTool, existingSlugs: Set<string>): GeneratedTool | null {
  if (!tool.slug || !/^[a-z0-9-]+$/.test(tool.slug)) {
    console.error(`Invalid slug: "${tool.slug}"`);
    return null;
  }
  if (existingSlugs.has(tool.slug)) {
    console.log(`Tool already exists: ${tool.slug}`);
    return null;
  }
  if (!tool.name || !tool.description || !tool.url) {
    console.error(`Missing required fields for: ${tool.slug}`);
    return null;
  }
  if (!tool.category || !tool.category.every(c => VALID_CATEGORIES.includes(c))) {
    console.error(`Invalid category for: ${tool.slug} - ${tool.category}`);
    return null;
  }
  if (tool.status !== 'draft') {
    // Force draft regardless of what Claude returned
    tool.status = 'draft';
  }

  // Clean content - no em dashes
  tool.description = tool.description
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-');

  // Ensure logoUrl uses the actual slug
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

  const suggestions = loadSuggestions();
  if (suggestions.length === 0) {
    console.log('No scraped suggestions found. Skipping tool generation.');
    process.exit(0);
  }

  const existingSlugs = getExistingToolSlugs();

  // Filter: min votes + not already in tools dir
  // Also filter by simple slug dedup (PH slugs like "cursor-3" map to "cursor" which exists)
  const candidates = suggestions
    .filter(s => (s.votesCount ?? 0) >= MIN_VOTES)
    .filter(s => {
      // Rough check: strip number suffix and see if base slug exists
      const baseSlug = s.slug.replace(/-\d+$/, '');
      return !existingSlugs.has(s.slug) && !existingSlugs.has(baseSlug);
    })
    .sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0))
    .slice(0, MAX_TOOLS_PER_RUN * 3); // fetch more than needed since Claude may reject some

  console.log(`${candidates.length} candidates for tool generation (${suggestions.length} total suggestions)`);

  if (candidates.length === 0) {
    console.log('No qualifying candidates. Skipping tool generation.');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  let generated = 0;

  for (const suggestion of candidates) {
    if (generated >= MAX_TOOLS_PER_RUN) break;

    console.log(`Generating tool: "${suggestion.name}" (${suggestion.votesCount} votes)...`);

    const raw = await generateTool(client, suggestion);
    if (!raw) {
      console.log(`  -> Skipped (Claude determined it doesn't fit site categories)`);
      continue;
    }

    const validated = validateTool(raw, existingSlugs);
    if (!validated) continue;

    const outPath = path.join(TOOLS_DIR, `${validated.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(validated, null, 2));
    existingSlugs.add(validated.slug);

    appendBotLog(`tool (draft): ${validated.name} -> https://aitoolcrunch.com/tools/${validated.slug}`);

    console.log(`Wrote: data/tools/${validated.slug}.json (status: draft - review before publishing)`);
    generated++;
  }

  console.log(`Done. Generated ${generated} tool draft(s).`);
}

main().catch(console.error).finally(() => process.exit(0));
