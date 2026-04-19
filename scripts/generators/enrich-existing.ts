/**
 * One-shot enrichment script for AIToolCrunch.
 *
 * Does three things:
 * 1. Re-generates all auto-authored blog posts with the new rich prompt
 * 2. Populates bestFor, keyStrength, scores for all tool JSONs missing them
 * 3. Pings Google to re-fetch the sitemap
 *
 * Run once manually:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generators/enrich-existing.ts
 *
 * Safe to re-run: skips tools that already have all three fields populated.
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const BLOG_DIR = path.join(process.cwd(), 'data', 'blog');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');
const SITE_URL = 'https://aitoolcrunch.com';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function cleanContent(html: string): string {
  return html
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/^\s+/gm, '');
}

function parseJsonFromResponse(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Load helpers ───────────────────────────────────────────────────────────────

function loadTools(): { slug: string; name: string }[] {
  return fs.readdirSync(TOOLS_DIR)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
        return [{ slug: t.slug, name: t.name }];
      } catch { return []; }
    });
}

function loadComparisonSlugs(): string[] {
  if (!fs.existsSync(COMPARISONS_FILE)) return [];
  try {
    return (JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as { slug: string }[]).map(c => c.slug);
  } catch { return []; }
}

// ── 1. Blog post re-generation ─────────────────────────────────────────────────

const BLOG_SYSTEM_PROMPT = `You are a staff writer for AIToolCrunch, an AI tools comparison site. Re-write an existing blog post with richer, more varied content that feels genuinely human.

TONE AND VOICE:
- Write like a knowledgeable colleague who has actually used these tools
- Vary sentence length dramatically - mix 5-word punchy sentences with longer analytical ones
- Be opinionated. Take a clear stance when evidence supports it.
- No exclamation marks. No filler: "let's dive in", "it's worth noting", "in this post we will"
- No em dashes or en dashes - use a hyphen or rewrite

STRUCTURE - pick what fits this specific story, do NOT follow a template:
- Opening: the most interesting/surprising thing about the story. Never "X landed on HN with Y points". Never a question opener.
- 4-7 sections. Headings should be specific and opinionated ("The $200 question nobody's answering" not "Pricing")
- Mix paragraph lengths: some 1-2 sentence punchy ones, some 4-5 sentence analytical ones
- End with something concrete: a takeaway, prediction, or specific recommendation

HTML - use rich formatting where it genuinely helps:
- <p> for body paragraphs
- <h2> for major sections, <h3> for sub-points
- <strong> to emphasize a key term or surprising fact (max 3-4 per post)
- <ul><li> or <ol><li> for genuine lists
- <blockquote> when quoting a specific person, post, or announcement verbatim
- <table><thead><tbody><tr><th><td> for side-by-side data (pricing, benchmarks)
- <code> for command snippets, model names, config values
- <a href="..."> for both internal AND external links

LINKS:
- External: link to sources being discussed (announcements, HN threads, GitHub repos)
- Internal tools: <a href='/tools/slug'>Tool Name</a>
- Internal comparisons: <a href='/compare/slug'>text</a>
- 2-3 external + 2-3 internal per post

BANNED PATTERNS:
- Never start with "X landed on Hacker News with Y points" or any variation
- Never use h2 patterns: "What X actually is", "Who this is for", "The broader picture", "What this means for the market"
- No em dashes (U+2014) or en dashes (U+2013)
- No leading spaces

Return ONLY valid JSON, no markdown fences:
{"title":"Title Under 70 Characters","excerpt":"1-2 sentence direct summary","content":"<full HTML>"}`;

async function rewriteBlogPost(
  client: Anthropic,
  post: Record<string, unknown>,
  tools: { slug: string; name: string }[],
  comparisonSlugs: string[],
): Promise<{ title: string; excerpt: string; content: string } | null> {
  const toolList = tools.map(t => `${t.name} -> /tools/${t.slug}`).join('\n');
  const compList = comparisonSlugs.slice(0, 30).join('\n');

  const userPrompt = `Re-write this blog post with richer formatting and more varied structure.
Preserve the core topic and factual claims. Improve the structure, formatting, voice, and variety.
Keep approximately the same length (800-1200 words) but make it feel genuinely written, not templated.

Current title: ${post.title}
Current excerpt: ${post.excerpt}
Current content:
${post.content}

Available tools for internal links:
${toolList}

Available comparison pages (/compare/slug):
${compList}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: BLOG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return parseJsonFromResponse(text) as { title: string; excerpt: string; content: string };
  } catch (err) {
    console.error(`  Blog rewrite failed: ${err}`);
    return null;
  }
}

async function enrichBlogPosts(client: Anthropic): Promise<void> {
  const tools = loadTools();
  const comparisonSlugs = loadComparisonSlugs();

  const autoPosts = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => {
      try {
        const post = JSON.parse(fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8'));
        return post.author === 'AIToolCrunch' ? [{ file: f, post }] : [];
      } catch { return []; }
    });

  console.log(`\n=== Re-writing ${autoPosts.length} auto-generated blog posts ===`);

  for (let i = 0; i < autoPosts.length; i++) {
    const { file, post } = autoPosts[i];
    console.log(`[${i + 1}/${autoPosts.length}] ${file}`);

    const result = await rewriteBlogPost(client, post, tools, comparisonSlugs);
    if (!result) continue;

    const updated = {
      ...post,
      title: result.title || post.title,
      excerpt: result.excerpt || post.excerpt,
      content: cleanContent(result.content),
    };

    fs.writeFileSync(path.join(BLOG_DIR, file), JSON.stringify(updated, null, 2));
    console.log(`  Done.`);

    // Pause between calls to avoid rate limits
    if (i < autoPosts.length - 1) await sleep(1000);
  }
}

// ── 2. Tool enrichment ─────────────────────────────────────────────────────────

const TOOL_ENRICH_SYSTEM = `You are a content editor for AIToolCrunch. Given a tool's existing data, generate three missing fields.

Return ONLY valid JSON, no markdown fences:
{
  "bestFor": "One sentence: who is the ideal user/use case (under 80 chars)",
  "keyStrength": "One sentence: the single most important competitive advantage (under 80 chars)",
  "scores": {
    "easeOfUse": 4.2,
    "learningCurve": 3.8
  }
}

Rules:
- easeOfUse: 1-5, how intuitive the interface is for a new user
- learningCurve: 1-5, how quickly someone becomes productive (5 = very fast)
- bestFor: concrete and specific ("Developers building multi-step AI workflows" not "Anyone who wants to automate")
- keyStrength: the one thing this tool does better than alternatives
- No em dashes, no exclamation marks, no leading spaces`;

async function enrichToolFields(client: Anthropic): Promise<void> {
  const toolFiles = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json'));
  const needsEnrichment = toolFiles.filter(f => {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
      return !t.bestFor || !t.keyStrength || !t.scores;
    } catch { return false; }
  });

  console.log(`\n=== Enriching ${needsEnrichment.length} tools with bestFor/keyStrength/scores ===`);

  for (let i = 0; i < needsEnrichment.length; i++) {
    const file = needsEnrichment[i];
    const toolPath = path.join(TOOLS_DIR, file);
    const tool = JSON.parse(fs.readFileSync(toolPath, 'utf-8'));

    console.log(`[${i + 1}/${needsEnrichment.length}] ${tool.name}`);

    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system: TOOL_ENRICH_SYSTEM,
        messages: [{
          role: 'user',
          content: `Tool: ${tool.name}
Category: ${tool.category?.join(', ')}
Tagline: ${tool.tagline}
Description: ${tool.description?.slice(0, 400)}
Pros: ${tool.pros?.join(', ')}
Cons: ${tool.cons?.join(', ')}
Starting price: ${tool.pricing?.startingPrice ?? 'free'}
Has free: ${tool.pricing?.hasFree}`
        }],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const fields = parseJsonFromResponse(text) as {
        bestFor: string;
        keyStrength: string;
        scores: { easeOfUse: number; learningCurve: number };
      };

      const updated = { ...tool, ...fields, lastUpdated: getToday() };
      fs.writeFileSync(toolPath, JSON.stringify(updated, null, 2));
      console.log(`  Done. bestFor: "${fields.bestFor}"`);
    } catch (err) {
      console.error(`  Failed: ${err}`);
    }

    if (i < needsEnrichment.length - 1) await sleep(500);
  }
}

// ── 3. Ping Google ─────────────────────────────────────────────────────────────

async function pingSitemapToGoogle(): Promise<void> {
  console.log('\n=== Pinging Google to re-fetch sitemap ===');
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  try {
    const res = await fetch(pingUrl);
    console.log(`Google ping: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`Google ping failed: ${err}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  await enrichBlogPosts(client);
  await enrichToolFields(client);
  await pingSitemapToGoogle();

  console.log('\nAll done. Review changes then: git add data/ && git commit && git push');
}

main().catch(console.error).finally(() => process.exit(0));
