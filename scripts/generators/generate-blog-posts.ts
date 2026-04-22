/**
 * Automated blog post generator for AIToolCrunch.
 *
 * Reads data/blog-ideas.json (populated daily by the blog-ideas scraper),
 * uses Claude Haiku to select the best ideas and Claude Sonnet to write
 * full blog posts with varied structure and a quality scan/rewrite pass.
 *
 * Variable frequency: 0-3 posts per day, weighted randomly and adjusted
 * by idea quality. Posts use anti-repetition history to avoid reusing
 * the same H2 headings, opening approaches, and section structures.
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Cost: ~$0.10-0.15 per run (Haiku for selection/meta, Sonnet for content)
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { scanForViolations, hasBannedContent, getBannedPhrasesForPrompt } from './lib/banned-patterns.js';
import { generateStructure, structureToPromptBlock } from './lib/structure-generator.js';
import {
  loadHistory,
  saveToHistory,
  recordZeroPostDay,
  buildAvoidancePrompt,
} from './lib/anti-repetition.js';
import { critiqueAndRewrite } from './lib/quality-pass.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const BLOG_DIR = path.join(process.cwd(), 'data', 'blog');
const IDEAS_FILE = path.join(process.cwd(), 'data', 'blog-ideas.json');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');
const PUBLISHED_URLS_FILE = path.join(process.cwd(), 'data', 'blog-published-urls.json');
const BOT_LOG_LATEST = path.join(process.cwd(), 'data', 'bot-log-latest.txt');
const BOT_LOG_ALL = path.join(process.cwd(), 'data', 'bot-log.txt');

const IDEA_FRESHNESS_DAYS = 7;

// ── Tagged Unsplash Image Pool ─────────────────────────────────────────────────

interface TaggedImage {
  id: string;
  topics: string[];
}

const UNSPLASH_POOL: TaggedImage[] = [
  { id: '1484480974693-6ca0a78fb36b', topics: ['technology', 'data', 'network'] },
  { id: '1498050108023-c5249f4df085', topics: ['code', 'technology', 'laptop'] },
  { id: '1517694712202-14dd9538aa97', topics: ['code', 'laptop', 'developer'] },
  { id: '1531297484001-80022131f5a1', topics: ['ai', 'technology', 'future'] },
  { id: '1488229297570-58520851e868', topics: ['code', 'monitor', 'developer'] },
  { id: '1451187580459-43490279c0fa', topics: ['data', 'network', 'globe'] },
  { id: '1573164713714-d95e436ab8d6', topics: ['ai', 'robot', 'technology'] },
  { id: '1485827404703-89b55fcc595e', topics: ['ai', 'technology', 'abstract'] },
  { id: '1550751827-4bd374c3f58b', topics: ['security', 'cybersecurity', 'technology'] },
  { id: '1571171637578-41bc2dd41cd2', topics: ['developer', 'code', 'screen'] },
  { id: '1510915228340-29c85a43dcfe', topics: ['writing', 'work', 'desk'] },
  { id: '1516116216624-53e697fedbea', topics: ['technology', 'abstract', 'digital'] },
  { id: '1527689368864-3a821dbccc34', topics: ['mobile', 'phone', 'technology'] },
  { id: '1537432376769-00f5c2f4c8d2', topics: ['code', 'screen', 'developer'] },
  { id: '1580752300992-559f8e0734e0', topics: ['technology', 'future', 'abstract'] },
  { id: '1600267175161-cfaa711b4a81', topics: ['business', 'office', 'team'] },
  { id: '1605792657660-596af9009e82', topics: ['ai', 'digital', 'technology'] },
  { id: '1629904853716-f0bc54eea481', topics: ['code', 'developer', 'monitor'] },
  { id: '1639762681485-074b7f938ba0', topics: ['ai', 'abstract', 'digital'] },
  { id: '1655721529003-5e48ce5f5566', topics: ['technology', 'ai', 'future'] },
  { id: '1676277791608-f93f87dd91c3', topics: ['ai', 'digital', 'abstract'] },
  { id: '1682687220989-cbf16b25d4f0', topics: ['technology', 'network', 'data'] },
  { id: '1696258686454-60082b2c33e6', topics: ['ai', 'robot', 'future'] },
  { id: '1707343843437-caacff5cfa74', topics: ['developer', 'code', 'work'] },
  { id: '1552664730-d307ca884978', topics: ['team', 'meeting', 'business'] },
  { id: '1460925895917-afdab827c52f', topics: ['chart', 'data', 'business', 'analytics'] },
  { id: '1504868584819-f8e8b4b6d7e3', topics: ['chart', 'growth', 'business'] },
  { id: '1432888498266-38ffec3eaf0a', topics: ['writing', 'notebook', 'creativity'] },
  { id: '1519337265831-281ec6cc8514', topics: ['creativity', 'design', 'art'] },
  { id: '1543269865-cbf427effbad', topics: ['team', 'collaboration', 'office'] },
  { id: '1586953208448-b95a79798f07', topics: ['mobile', 'app', 'phone'] },
  { id: '1611162617213-7d7a39e9b1d7', topics: ['mobile', 'tech', 'phone'] },
  { id: '1563986768609-322da13575f3', topics: ['security', 'lock', 'protection'] },
  { id: '1614064641938-2de3ccf3a7b4', topics: ['ai', 'circuit', 'chip'] },
  { id: '1526374965328-7f61d4dc18c5', topics: ['code', 'matrix', 'digital'] },
  { id: '1454165804606-c3d57bc86b40', topics: ['business', 'work', 'laptop'] },
  { id: '1507003211169-0a1dd7228f2d', topics: ['team', 'people', 'office'] },
  { id: '1559136555-9303baea8eae', topics: ['office', 'work', 'desk'] },
  { id: '1581091226825-a6a2a5aee158', topics: ['technology', 'developer', 'code'] },
  { id: '1593642632559-0c6d3fc62b89', topics: ['remote', 'work', 'laptop'] },
];

const VALID_TAGS = [
  'ai-code', 'ai-trends', 'real-world', 'announcements', 'ai-writing',
  'comparison', 'ai-stories', 'ai-automation', 'how-to', 'ai-business',
  'ai-image', 'ai-audio', 'ai-video',
];

// ── Style seed paragraphs ──────────────────────────────────────────────────────
// Examples of high-quality human tech writing used to calibrate the model's
// style. These show variety in sentence structure, specificity, and voice.

const STYLE_SEEDS = `REFERENCE WRITING QUALITY - match this level of specificity and naturalness:

Example 1 (direct, analytical):
"The gap between what a tool promises and what it delivers in practice is usually a pricing decision. Anthropic's Claude can write code. So can GPT-4. The difference is not capability - both will produce working Python for most tasks - it is where each system breaks down. Claude tends to be more careful with long context. GPT-4 tends to be faster at short turnaround tasks. Neither is universally better. The question is which failure mode costs you less."

Example 2 (concrete, specific):
"I tested three AI video tools on the same script last week. Synthesia produced the avatar in 14 minutes. HeyGen took 9. Runway took 3, but the output needed two rounds of correction. Time to usable output, not time to first render, is the number that matters for production workflows."

Example 3 (measured, with appropriate nuance):
"There is a version of the 'AI will replace developers' argument that is wrong in an interesting way. It is not that AI cannot write code - it clearly can. It is that writing code was never the bottleneck. The bottleneck is knowing what to build, catching what is wrong, and maintaining what exists. Those tasks have not gotten faster."`;

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface BlogIdea {
  title: string;
  url: string;
  source: string;
  summary: string;
  score?: number;
  fetchedAt: string;
}

interface PublishedUrl {
  url: string;
  slug: string;
  publishedAt: string;
}

interface SelectedIdea extends BlogIdea {
  suggestedSlug: string;
  suggestedTags: string[];
  reason: string;
}

interface GeneratedPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
}

interface ToolInfo {
  slug: string;
  name: string;
}

// ── Variable posting frequency ─────────────────────────────────────────────────

function decidePostCount(freshIdeas: BlogIdea[], consecutiveZeroDays: number): number {
  // Weighted random: 0=10%, 1=30%, 2=40%, 3=20%
  const rand = Math.random();
  let base: number;
  if (rand < 0.10) base = 0;
  else if (rand < 0.40) base = 1;
  else if (rand < 0.80) base = 2;
  else base = 3;

  // Adjust by idea quality
  const maxScore = Math.max(...freshIdeas.map(i => i.score ?? 0));
  if (maxScore > 500 && base < 3) base = Math.min(base + 1, 3);
  if (maxScore < 100 && base > 1) base = 1;

  // Safety: never skip 3 days in a row
  if (consecutiveZeroDays >= 2 && base === 0) base = 1;

  // Cap to available ideas
  return Math.min(base, freshIdeas.length);
}

// ── Data loading ───────────────────────────────────────────────────────────────

function loadBlogIdeas(): BlogIdea[] {
  if (!fs.existsSync(IDEAS_FILE)) { console.log('No blog-ideas.json found, skipping.'); return []; }
  try { return JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8')); }
  catch { console.error('Failed to parse blog-ideas.json'); return []; }
}

function loadPublishedUrls(): PublishedUrl[] {
  if (!fs.existsSync(PUBLISHED_URLS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(PUBLISHED_URLS_FILE, 'utf-8')); }
  catch { return []; }
}

function savePublishedUrls(list: PublishedUrl[]): void {
  fs.writeFileSync(PUBLISHED_URLS_FILE, JSON.stringify(list, null, 2));
}

function loadExistingPosts(): { slugs: Set<string>; titles: string[]; usedImageIds: Set<string> } {
  const slugs = new Set<string>();
  const titles: string[] = [];
  const usedImageIds = new Set<string>();
  if (!fs.existsSync(BLOG_DIR)) return { slugs, titles, usedImageIds };
  for (const file of fs.readdirSync(BLOG_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const post = JSON.parse(fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8'));
      if (post.slug) slugs.add(post.slug);
      if (post.title) titles.push(post.title);
      if (post.coverImage) {
        const match = post.coverImage.match(/photo-([a-zA-Z0-9_-]+)/);
        if (match) usedImageIds.add(match[1]);
      }
    } catch { /* skip malformed */ }
  }
  return { slugs, titles, usedImageIds };
}

function loadTools(): ToolInfo[] {
  if (!fs.existsSync(TOOLS_DIR)) return [];
  return fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json')).flatMap(f => {
    try {
      const tool = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
      return [{ slug: tool.slug as string, name: tool.name as string }];
    } catch { return []; }
  });
}

function loadComparisonSlugs(): string[] {
  if (!fs.existsSync(COMPARISONS_FILE)) return [];
  try { return (JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as { slug: string }[]).map(c => c.slug); }
  catch { return []; }
}

// ── Image handling ─────────────────────────────────────────────────────────────

async function validateUnsplashId(id: string): Promise<boolean> {
  try {
    const res = await fetch(`https://images.unsplash.com/photo-${id}?w=100&q=10`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch { return false; }
}

async function getValidPoolIds(usedImageIds: Set<string>): Promise<TaggedImage[]> {
  const candidates = UNSPLASH_POOL.filter(img => !usedImageIds.has(img.id));
  if (candidates.length === 0) return UNSPLASH_POOL;
  const results = await Promise.all(candidates.map(async img => ({ img, valid: await validateUnsplashId(img.id) })));
  const valid = results.filter(r => r.valid).map(r => r.img);
  console.log(`Image pool: ${valid.length}/${candidates.length} candidate IDs valid`);
  return valid.length > 0 ? valid : candidates;
}

function pickCoverImage(validImages: TaggedImage[]): string {
  const img = validImages[Math.floor(Math.random() * validImages.length)];
  return `https://images.unsplash.com/photo-${img.id}?w=1200&q=80`;
}

// ── Content helpers ────────────────────────────────────────────────────────────

function cleanContent(html: string): string {
  return html
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/^\s+/gm, '');
}

function extractHtmlContent(raw: string): string {
  const stripped = raw
    .replace(/^```(?:json|html|javascript|typescript|js|ts)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (stripped.startsWith('{')) {
    try {
      const parsed = JSON.parse(stripped) as { content?: string };
      if (parsed.content && parsed.content.length > 100) return parsed.content;
    } catch { /* treat as raw HTML */ }
  }
  return stripped;
}

function parseJsonFromResponse(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function appendBotLog(line: string): void {
  const dated = `[${getToday()}] ${line}`;
  fs.appendFileSync(BOT_LOG_LATEST, line + '\n');
  const existing = fs.existsSync(BOT_LOG_ALL) ? fs.readFileSync(BOT_LOG_ALL, 'utf-8') : '';
  fs.writeFileSync(BOT_LOG_ALL, dated + '\n' + existing);
}

// ── API calls ──────────────────────────────────────────────────────────────────

async function selectBestIdeas(
  client: Anthropic,
  ideas: BlogIdea[],
  existingTitles: string[],
  tools: ToolInfo[],
  count: number,
): Promise<SelectedIdea[]> {
  const toolNames = tools.map(t => t.name).join(', ');
  const systemPrompt = `You are the editorial director of AIToolCrunch, an AI tools comparison and review website. Select the ${count} best blog post ideas from a list of scraped news items.

The site covers: AI Writing, AI Image, AI Code, AI Video, AI Audio, and AI Automation tools. It features: ${toolNames}.

Selection criteria (in order):
1. Relevance to AI tools the site covers
2. Timeliness - prefer items from the last 48 hours
3. Not a duplicate of an existing post - check existing titles for semantic overlap
4. Has potential for internal links to tools on the site

Return ONLY a valid JSON array of exactly ${count} objects. No markdown fences, no explanation:
[{"title":"exact scraped title","url":"exact url","source":"exact source","summary":"exact summary","score":0,"fetchedAt":"exact fetchedAt","suggestedSlug":"lowercase-hyphenated-max-6-words","suggestedTags":["tag1"],"reason":"one sentence why"}]

Valid tags: ${VALID_TAGS.join(', ')}`;

  const userPrompt = `Today: ${getToday()}

Existing post titles to avoid duplicating:
${existingTitles.slice(0, 50).map(t => `- ${t}`).join('\n')}

Ideas to choose from (pick the ${count} best):
${JSON.stringify(ideas, null, 2)}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseJsonFromResponse(text) as SelectedIdea[];
}

function buildContentSystemPrompt(avoidancePrompt: string, structureBlock: string): string {
  const bannedPhrases = getBannedPhrasesForPrompt();

  return `You are a staff writer for AIToolCrunch, an AI tools comparison and review site.

${STYLE_SEEDS}

VOICE AND TONE:
- Write with the specificity and naturalness of the examples above
- Vary sentence length: some sentences under 8 words, some 25-40 words with subordinate clauses
- Be direct and opinionated. Take a clear stance when the evidence supports it.
- Use concrete details: numbers, names, dates, specific tool behaviors
- No exclamation marks
- No em dashes (U+2014) or en dashes (U+2013) - use a hyphen or rewrite the sentence
- No leading spaces on any line

BANNED WORDS AND PHRASES - do not use any of these:
${bannedPhrases}

BANNED H2 HEADING PATTERNS - do not use H2 headings that match these:
- "What [X] actually does/is/means" (any use of "actually" in a heading)
- "Who this is for"
- "The bigger/broader picture/signal/shift/pattern"
- "What this means for [X]"
- "Final thoughts", "Conclusion", "Wrapping up", "In summary"
- "The bottom line", "The honest [anything]"
- "What comes next", "Moving forward", "Looking ahead"
- "Key takeaways"

${avoidancePrompt ? avoidancePrompt + '\n' : ''}
LINKS:
- Link to the source URL and 1-2 other relevant external sources
- Internal tool links: <a href='/tools/slug'>Tool Name</a>
- Internal comparison links: <a href='/compare/slug'>descriptive anchor text</a>
- Include 2-3 external and 2-3 internal links total

IMAGES:
- Place exactly 1 inline image marker somewhere in the body, between two sections where it fits the topic.
- Format: <!-- IMG:topic1,topic2|Alt text describing what the image shows in context|Caption that explains why this image is here and what it illustrates for this specific section -->
- The caption must be specific to the post topic - not generic. Bad: "A developer at a computer". Good: "Token usage breakdown across a Claude Code session with multiple file edits"
- Pick topics from: code, developer, laptop, screen, monitor, ai, robot, technology, data, network, chart, analytics, business, team, meeting, office, writing, creativity, mobile, security, abstract
- Do not describe the image as a "visual break" or anything decorative. It should add context.

AVAILABLE HTML ELEMENTS - use only what serves this specific content:
- TL;DR box: <div class="blog-tldr"><p>TL;DR</p><p>Summary here.</p></div>
- Stat highlight: <div class="blog-stat"><p class="stat-number">47%</p><p class="stat-label">label</p></div>
- Pull quote: <aside class="blog-pullquote">Key insight that stands alone.</aside>
- Callout box: <div class="blog-callout"><p>Heading</p><p>Important detail.</p></div>
- Code block: <pre><code>command or snippet</code></pre>
- Inline code: <code>term</code>
- Table: <table><thead>...</thead><tbody>...</tbody></table>
- Blockquote: <blockquote>Direct quote with source.</blockquote>
- No h1 tags (the page already has an h1 from the post title)
- No full HTML document wrapper (no DOCTYPE, html, head, body tags)

${structureBlock}`;
}

async function generateBlogPost(
  client: Anthropic,
  idea: SelectedIdea,
  tools: ToolInfo[],
  comparisonSlugs: string[],
  recentPostSlugs: string[],
  avoidancePrompt: string,
  structureBlock: string,
): Promise<GeneratedPost | null> {
  const toolList = tools.map(t => `${t.name} -> /tools/${t.slug}`).join('\n');
  const compList = comparisonSlugs.slice(0, 30).join('\n');
  const recentList = recentPostSlugs.slice(0, 8).map(s => `/blog/${s}`).join('\n');

  const userPrompt = `Write a blog post based on this news item.

Title: ${idea.title}
Source URL (use this for the primary external link): ${idea.url}
Source: ${idea.source}
Summary: ${idea.summary}
Suggested slug: ${idea.suggestedSlug}

Available tools for internal links (Name -> /tools/slug):
${toolList}

Available comparison pages (/compare/slug):
${compList}

Recent posts for cross-linking (/blog/slug):
${recentList}`;

  const metaSystemPrompt = `You are an editor for AIToolCrunch. Given a news item, return ONLY a JSON object with slug, title, and excerpt. No content field, no markdown fences.
{"slug":"lowercase-hyphenated-max-6-words","title":"Under 70 chars, no em dashes","excerpt":"1-2 sentence direct summary, not clickbait, no em dashes"}`;

  try {
    // Call 1: meta (slug, title, excerpt) - Haiku is fast and accurate for structured output
    const metaMsg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: metaSystemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const metaText = metaMsg.content[0].type === 'text' ? metaMsg.content[0].text : '{}';
    const meta = parseJsonFromResponse(metaText) as { slug: string; title: string; excerpt: string };

    // Call 2: content - Sonnet for quality long-form writing
    const contentMsg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: buildContentSystemPrompt(avoidancePrompt, structureBlock),
      messages: [{ role: 'user', content: userPrompt }],
    });
    const rawContent = contentMsg.content[0].type === 'text' ? contentMsg.content[0].text : '';
    const content = extractHtmlContent(rawContent);

    return { slug: meta.slug, title: meta.title, excerpt: meta.excerpt, content };
  } catch (err) {
    console.error(`Generation failed for "${idea.title}": ${err}`);
    return null;
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validatePost(
  post: GeneratedPost,
  existingSlugs: Set<string>,
  tools: ToolInfo[],
  comparisonSlugs: string[],
): GeneratedPost | null {
  if (!post.slug || !/^[a-z0-9-]+$/.test(post.slug)) {
    console.error(`Invalid slug format: "${post.slug}"`); return null;
  }
  if (existingSlugs.has(post.slug)) {
    console.log(`Skipping duplicate slug: ${post.slug}`); return null;
  }
  if (!post.content || post.content.length < 500) {
    console.error(`Content too short for: ${post.slug} (${post.content?.length ?? 0} chars)`); return null;
  }
  if (!post.content.includes('<h2>') || !post.content.includes('<p>')) {
    console.error(`Content missing required HTML structure: ${post.slug}`); return null;
  }

  let content = cleanContent(post.content);

  content = content.replace(/<h1[^>]*>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>');
  content = content.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<\/?body[^>]*>/gi, '').trim();

  // Remove any unresolved IMG markers
  content = content.replace(/<!--\s*IMG:[^>]*-->/gi, '');

  // Validate internal links
  const toolSlugs = new Set(tools.map(t => t.slug));
  const compSlugs = new Set(comparisonSlugs);
  const validatedContent = content.replace(/href='(\/(?:tools|compare|blog)\/[^']+)'/g, (match, href) => {
    const parts = href.split('/');
    const type = parts[1]; const slug = parts[2];
    if (type === 'tools' && !toolSlugs.has(slug)) return `href='/'`;
    if (type === 'compare' && !compSlugs.has(slug)) return `href='/'`;
    return match;
  });

  return {
    slug: post.slug,
    title: cleanContent(post.title.trim()),
    excerpt: cleanContent(post.excerpt.trim()),
    content: validatedContent,
  };
}

// ── Comparison body generator ──────────────────────────────────────────────────

interface ComparisonEntry {
  slug: string; toolA: string; toolB: string;
  title?: string; verdict?: string; winner?: string; body?: string;
}

interface FullToolData {
  slug: string; name: string; tagline: string; description: string;
  features: string[]; pros: string[]; cons: string[];
  pricing: { hasFree: boolean; startingPrice: string | null; plans: { name: string; price: string; features: string[] }[] };
  bestFor?: string; keyStrength?: string; category: string[];
}

function loadFullTool(slug: string): FullToolData | null {
  const file = path.join(process.cwd(), 'data', 'tools', `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

async function generateComparisonBody(client: Anthropic, comp: ComparisonEntry): Promise<string | null> {
  const toolA = loadFullTool(comp.toolA);
  const toolB = loadFullTool(comp.toolB);
  if (!toolA || !toolB) return null;

  const systemPrompt = `You are a staff writer for AIToolCrunch. Write a rich editorial comparison section in HTML.

This appears on a comparison page that already has: a side-by-side specs table, a verdict box, and both tools' pros/cons lists. Do NOT repeat those elements.

Write 500-800 words covering:
- The most important practical difference (not just specs - the real day-to-day difference)
- Specific use cases where each tool clearly wins
- Pricing reality - not just numbers, but what you actually get
- One specific scenario or user type for each tool

HTML allowed: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>
- Use <h2> for 2-3 major sections
- No em dashes, no en dashes, no exclamation marks, no leading spaces
- No generic headings: "Overview", "Introduction", "Final Thoughts", "Conclusion"
- No verdict or recommendation (that is in a separate section on the page)
- No h1 tags, no DOCTYPE, no full HTML document wrapper

Return ONLY the raw HTML string. No JSON wrapper, no markdown fences.`;

  const userPrompt = `Write the editorial body for: ${toolA.name} vs ${toolB.name}

${toolA.name}: tagline="${toolA.tagline}" bestFor="${toolA.bestFor ?? 'n/a'}" price="${toolA.pricing.startingPrice ?? 'free'}" hasFree=${toolA.pricing.hasFree} features=[${toolA.features.slice(0, 5).join(', ')}] pros=[${toolA.pros.join(', ')}] cons=[${toolA.cons.join(', ')}]

${toolB.name}: tagline="${toolB.tagline}" bestFor="${toolB.bestFor ?? 'n/a'}" price="${toolB.pricing.startingPrice ?? 'free'}" hasFree=${toolB.pricing.hasFree} features=[${toolB.features.slice(0, 5).join(', ')}] pros=[${toolB.pros.join(', ')}] cons=[${toolB.cons.join(', ')}]

Category: ${toolA.category.join(', ')}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    return cleanContent(extractHtmlContent(raw));
  } catch (err) {
    console.error(`Comparison body failed for ${comp.slug}: ${err}`); return null;
  }
}

async function enrichNewComparisons(client: Anthropic): Promise<void> {
  if (!fs.existsSync(COMPARISONS_FILE)) return;
  let comparisons: ComparisonEntry[];
  try { comparisons = JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')); }
  catch { return; }

  const needsBody = comparisons.filter(c => !c.body).slice(0, 5);
  if (needsBody.length === 0) { console.log('All comparisons already have body content.'); return; }

  console.log(`Generating body content for ${needsBody.length} comparison(s)...`);
  let enriched = 0;

  for (const comp of needsBody) {
    const body = await generateComparisonBody(client, comp);
    if (!body) continue;
    const idx = comparisons.findIndex(c => c.slug === comp.slug);
    if (idx !== -1) {
      comparisons[idx].body = body;
      enriched++;
      appendBotLog(`comparison: ${comp.toolA} vs ${comp.toolB} -> https://aitoolcrunch.com/compare/${comp.slug}`);
      console.log(`  Enriched: ${comp.slug}`);
    }
  }

  if (enriched > 0) {
    fs.writeFileSync(COMPARISONS_FILE, JSON.stringify(comparisons, null, 2));
    console.log(`Enriched ${enriched} comparison(s).`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.log('ANTHROPIC_API_KEY not set, skipping blog post generation.'); process.exit(0); }

  console.log('Starting automated blog post generation...');

  const allIdeas = loadBlogIdeas();
  const publishedUrls = loadPublishedUrls();
  const publishedUrlSet = new Set(publishedUrls.map(p => p.url));
  const { slugs: existingSlugs, titles: existingTitles, usedImageIds } = loadExistingPosts();
  const tools = loadTools();
  const comparisonSlugs = loadComparisonSlugs();
  const history = loadHistory();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - IDEA_FRESHNESS_DAYS);
  const freshIdeas = allIdeas.filter(i => new Date(i.fetchedAt) > cutoff && !publishedUrlSet.has(i.url));

  console.log(`${freshIdeas.length} fresh unpublished ideas available`);

  const postCount = decidePostCount(freshIdeas, history.consecutiveZeroDays ?? 0);
  console.log(`Decided to generate ${postCount} post(s) today`);

  if (postCount === 0) {
    appendBotLog('blog: skipped today (random variation)');
    recordZeroPostDay();
    console.log('Skipping blog posts today. Will enrich comparisons.');
    const client = new Anthropic({ apiKey });
    await enrichNewComparisons(client);
    process.exit(0);
  }

  if (freshIdeas.length < postCount) {
    console.log(`Only ${freshIdeas.length} ideas available, adjusting to that.`);
  }

  const actualCount = Math.min(postCount, freshIdeas.length);
  if (actualCount === 0) { console.log('No fresh ideas. Skipping generation.'); process.exit(0); }

  const validImages = await getValidPoolIds(usedImageIds);
  const client = new Anthropic({ apiKey });

  let selectedIdeas: SelectedIdea[];
  try {
    selectedIdeas = await selectBestIdeas(client, freshIdeas, existingTitles, tools, actualCount);
    if (!Array.isArray(selectedIdeas) || selectedIdeas.length === 0) { console.error('Idea selection returned no results.'); process.exit(0); }
    console.log(`Selected: ${selectedIdeas.map(i => i.suggestedSlug).join(', ')}`);
  } catch (err) {
    console.error(`Idea selection failed: ${err}`); process.exit(0);
  }

  const recentPostSlugs = Array.from(existingSlugs).slice(-10);
  const avoidancePrompt = buildAvoidancePrompt(history);
  const updatedPublishedUrls = [...publishedUrls];
  let generated = 0;

  for (const idea of selectedIdeas.slice(0, actualCount)) {
    // Generate a unique structure for this post
    const structure = generateStructure(history.recentStructures);
    const structureBlock = structureToPromptBlock(structure);
    console.log(`Generating: "${idea.title}" [opening: ${structure.opening.slice(0, 50)}...]`);

    const raw = await generateBlogPost(client, idea, tools, comparisonSlugs, recentPostSlugs, avoidancePrompt, structureBlock);
    if (!raw) continue;

    // Quality scan: check for banned patterns and rewrite if needed
    let content = raw.content;
    const violations = scanForViolations(content);
    if (hasBannedContent(content)) {
      console.log(`  Violations found: ${violations.phrases.length} phrases, ${violations.h2s.length} H2s, ${violations.opening.length} opening. Rewriting...`);
      content = await critiqueAndRewrite(client, content, violations);
      const recheck = scanForViolations(content);
      if (recheck.phrases.length > 0 || recheck.h2s.length > 0) {
        console.warn(`  Warning: ${recheck.phrases.length + recheck.h2s.length} violation(s) remain after rewrite. Publishing anyway.`);
      } else {
        console.log(`  Rewrite clean.`);
      }
    }

    const validated = validatePost({ ...raw, content }, existingSlugs, tools, comparisonSlugs);
    if (!validated) continue;

    if (validImages.length === 0) { console.error('No valid images available, skipping post.'); continue; }

    const coverImage = pickCoverImage(validImages);
    const imageId = coverImage.match(/photo-([a-zA-Z0-9_-]+)/)?.[1];
    if (imageId) {
      usedImageIds.add(imageId);
      const idx = validImages.findIndex(img => img.id === imageId);
      if (idx !== -1) validImages.splice(idx, 1);
    }

    const tags = (idea.suggestedTags ?? ['ai-trends']).filter(t => VALID_TAGS.includes(t));

    const post = {
      slug: validated.slug,
      title: validated.title,
      excerpt: validated.excerpt,
      author: 'AIToolCrunch',
      publishedAt: getToday(),
      tags: tags.length > 0 ? tags : ['ai-trends'],
      status: 'published',
      featured: false,
      coverImage,
      content: validated.content,
    };

    const outPath = path.join(BLOG_DIR, `${validated.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(post, null, 2));
    existingSlugs.add(validated.slug);

    // Save to anti-repetition history
    saveToHistory({ slug: validated.slug, title: validated.title, content: validated.content }, structure);

    updatedPublishedUrls.push({ url: idea.url, slug: validated.slug, publishedAt: getToday() });
    appendBotLog(`blog: ${validated.title} -> https://aitoolcrunch.com/blog/${validated.slug}`);
    console.log(`Wrote: data/blog/${validated.slug}.json`);
    generated++;
  }

  savePublishedUrls(updatedPublishedUrls.slice(-500));
  console.log(`Done. Generated ${generated} blog post(s).`);

  console.log('\nEnriching comparison pages...');
  await enrichNewComparisons(client);
}

main().catch(console.error).finally(() => process.exit(0));
