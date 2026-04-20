/**
 * Automated blog post generator for AIToolCrunch.
 *
 * Reads data/blog-ideas.json (populated daily by the blog-ideas scraper),
 * uses Claude Haiku to select the 2 best ideas and generate full blog posts
 * with varied structure templates and embedded images, then writes them to
 * data/blog/{slug}.json.
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Cost: ~$0.01 per run (2 posts, claude-haiku-4-5)
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ── Constants ──────────────────────────────────────────────────────────────────

const BLOG_DIR = path.join(process.cwd(), 'data', 'blog');
const IDEAS_FILE = path.join(process.cwd(), 'data', 'blog-ideas.json');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');
const PUBLISHED_URLS_FILE = path.join(process.cwd(), 'data', 'blog-published-urls.json');
const BOT_LOG_LATEST = path.join(process.cwd(), 'data', 'bot-log-latest.txt');
const BOT_LOG_ALL = path.join(process.cwd(), 'data', 'bot-log.txt');

const MAX_POSTS_PER_RUN = 2;
const IDEA_FRESHNESS_DAYS = 7;

// ── Tagged Unsplash Image Pool ─────────────────────────────────────────────────
// Validated IDs with topic tags for context-aware image selection.
// The model places <!-- IMG:topic1,topic2|alt|caption --> markers; this pool
// resolves them to real validated photo IDs.

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

// ── Structure Templates ────────────────────────────────────────────────────────

interface StructureTemplate {
  type: string;
  description: string;
  requiredElements: string[];
  openingInstruction: string;
  closingInstruction: string;
  sectionGuidance: string;
}

const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    type: 'news-reaction',
    description: 'Lead with the single most surprising fact from the news. 4-5 h2 sections analyzing what it means. Include a direct quote or announcement text in a blockquote.',
    requiredElements: ['blockquote'],
    openingInstruction: 'Open with the most surprising or counterintuitive fact from this story. Not "Company X announced Y" - the actual interesting thing about what was announced.',
    closingInstruction: 'End with a specific, falsifiable prediction about what happens next (something that will be proven right or wrong within 6 months).',
    sectionGuidance: 'Sections: [The fact that changes things] -> [What it actually means] -> [Who loses, who wins] -> [The prediction]. Use a blockquote for a key quote from the announcement or a notable reaction.',
  },
  {
    type: 'deep-dive',
    description: 'Technical depth with h3 sub-sections under each h2. 3-4 h2 sections, each broken into 2-3 h3 sub-points. Include code or command examples.',
    requiredElements: ['h3', 'code'],
    openingInstruction: 'Open with a specific technical observation, number, or benchmark result - something concrete that a developer would find immediately useful or alarming.',
    closingInstruction: 'End with a TL;DR box using: <div class="blog-tldr"><p>TL;DR</p><p>Two sentence summary of the technical situation and what to do about it.</p></div>',
    sectionGuidance: 'Use h2 for major themes, h3 for specific technical sub-points within each theme. Include at least one <code> snippet (even a CLI command counts). Structure: [Technical setup] -> [How it actually works] -> [Gotchas and edge cases] -> [TL;DR].',
  },
  {
    type: 'listicle',
    description: '5-7 numbered or ranked items as the spine of the post. Each item is an h2. Use an opening claim, then structured list, then synthesis.',
    requiredElements: ['ol'],
    openingInstruction: 'Open with a bold claim about what most people get wrong about this topic - something that will make the target reader think "wait, is that true?"',
    closingInstruction: 'End with a ranked recommendation table: which item from your list should different types of readers prioritize.',
    sectionGuidance: 'After the intro, use numbered h2 sections (e.g., "1. The context window problem"). Each h2 item gets 2-3 paragraphs of substance. At least one item should include an ordered list inside it. Close with a summary table.',
  },
  {
    type: 'comparison',
    description: 'Direct side-by-side analysis. Must include a comparison table. 3-4 h2 sections framing the comparison from different angles.',
    requiredElements: ['table'],
    openingInstruction: 'Open with the specific decision the reader is trying to make - frame it as "you are choosing between X and Y because Z." Do not start with company names.',
    closingInstruction: 'End with a recommendation matrix table: rows = user type, columns = which tool wins and why. Make it scannable and decisive.',
    sectionGuidance: 'Sections: [The decision framing] -> [Where they differ in practice] -> [Pricing reality] -> [Recommendation matrix table]. The table must have thead, tbody, real data - not placeholder content.',
  },
  {
    type: 'how-to',
    description: 'Practical step-by-step guide. Numbered steps are the backbone. Code blocks for commands. Concrete before/after framing.',
    requiredElements: ['ol', 'code'],
    openingInstruction: 'Open with the exact problem the reader has right now - be specific about the symptom, not the solution. Make them feel seen.',
    closingInstruction: 'End with a short checklist of things to verify after following the guide, formatted as an unordered list under the heading "Quick Verification Checklist".',
    sectionGuidance: 'Structure: [The problem] -> [Why most solutions fail] -> [Step-by-step guide with <ol> and <code> blocks] -> [Verification checklist]. Every step should be actionable. Include real commands or config snippets where relevant.',
  },
  {
    type: 'opinion',
    description: 'Strong editorial stance. Take a clear position and defend it. Use pull quotes for key claims. 4-5 h2 sections building the argument.',
    requiredElements: ['blockquote'],
    openingInstruction: 'Open with a contrarian claim or a question that challenges something the target reader probably believes. Make it feel slightly provocative but defensible.',
    closingInstruction: 'End with a direct challenge or call to action for the reader - something specific they should do or think about differently this week.',
    sectionGuidance: 'Build an argument progressively: [The claim] -> [The evidence people ignore] -> [The counterargument (steelmanned)] -> [Why the counterargument fails] -> [The direct challenge]. Use <aside class="blog-pullquote"> for 1-2 key claims you want to stand alone.',
  },
];

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

function pickInlineImage(pool: TaggedImage[], topics: string[], usedInlineIds: Set<string>): TaggedImage | null {
  // Score each image by topic overlap, excluding already-used ones
  const available = pool.filter(img => !usedInlineIds.has(img.id));
  if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)] ?? null;
  const topicsLower = topics.map(t => t.toLowerCase());
  const scored = available.map(img => ({
    img,
    score: img.topics.filter(t => topicsLower.includes(t)).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  // Pick from top matches (add randomness if score is 0)
  const topScore = scored[0].score;
  const topMatches = topScore > 0 ? scored.filter(s => s.score === topScore) : scored.slice(0, 5);
  return topMatches[Math.floor(Math.random() * topMatches.length)].img;
}

/**
 * Replaces <!-- IMG:topics|alt|caption --> markers with real <figure> elements.
 * If no markers found, inserts one after the second </h2> as a fallback.
 */
function resolveImageMarkers(content: string, pool: TaggedImage[], usedInlineIds: Set<string>): string {
  const markerRegex = /<!--\s*IMG:([^|>]+)\|([^|>]*)\|([^>]*?)-->/gi;
  let resolved = content;
  let hasMarker = markerRegex.test(content);

  if (!hasMarker) {
    // Insert a fallback marker after the 2nd </h2>
    let count = 0;
    resolved = content.replace(/<\/h2>/gi, (match) => {
      count++;
      return count === 2 ? `${match}\n<!-- IMG:technology,code|A developer working on a modern application|Visual break -->` : match;
    });
    hasMarker = /<!--\s*IMG:/i.test(resolved);
  }

  // Now replace all markers
  resolved = resolved.replace(/<!--\s*IMG:([^|>\n]+)\|([^|>\n]*)\|([^>\n]*?)-->/gi, (_match, topicsStr, alt, caption) => {
    const topics = topicsStr.split(',').map((t: string) => t.trim());
    const img = pickInlineImage(pool, topics, usedInlineIds);
    if (!img) return '';
    usedInlineIds.add(img.id);
    const altText = alt.trim() || 'Inline image';
    const captionText = caption.trim();
    const figCaption = captionText ? `<figcaption>${captionText}</figcaption>` : '';
    return `<figure><img src="https://images.unsplash.com/photo-${img.id}?w=800&q=80" alt="${altText}" loading="lazy" />${figCaption}</figure>`;
  });

  return resolved;
}

// ── Content helpers ────────────────────────────────────────────────────────────

function cleanContent(html: string): string {
  return html
    .replace(/\u2014/g, '-')   // em dash
    .replace(/\u2013/g, '-')   // en dash
    .replace(/^\s+/gm, '');    // leading whitespace per line
}

/** Strip markdown code fences and extract HTML from model responses. */
function extractHtmlContent(raw: string): string {
  const stripped = raw
    .replace(/^```(?:json|html|javascript|typescript|js|ts)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  // If model returned JSON with a content field, extract it
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
): Promise<SelectedIdea[]> {
  const toolNames = tools.map(t => t.name).join(', ');
  const systemPrompt = `You are the editorial director of AIToolCrunch, an AI tools comparison and review website. Select the 2 best blog post ideas from a list of scraped news items.

The site covers: AI Writing, AI Image, AI Code, AI Video, AI Audio, and AI Automation tools. It features: ${toolNames}.

Selection criteria (in order):
1. Relevance to AI tools the site covers
2. Timeliness - prefer items from the last 48 hours
3. Not a duplicate of an existing post - check existing titles for semantic overlap
4. Has potential for internal links to tools on the site

Return ONLY a valid JSON array of exactly 2 objects. No markdown fences, no explanation:
[{"title":"exact scraped title","url":"exact url","source":"exact source","summary":"exact summary","score":0,"fetchedAt":"exact fetchedAt","suggestedSlug":"lowercase-hyphenated-max-6-words","suggestedTags":["tag1"],"reason":"one sentence why"}]

Valid tags: ${VALID_TAGS.join(', ')}`;

  const userPrompt = `Today: ${getToday()}

Existing post titles to avoid duplicating:
${existingTitles.slice(0, 50).map(t => `- ${t}`).join('\n')}

Ideas to choose from (pick the 2 best):
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

function buildContentSystemPrompt(template: StructureTemplate): string {
  const BASE_RULES = `You are a staff writer for AIToolCrunch, an AI tools comparison site. Write an engaging blog post that feels genuinely human - not a template being filled in.

TONE AND VOICE:
- Write like a knowledgeable colleague who has actually used these tools
- Vary sentence length dramatically - mix 5-word punchy sentences with longer analytical ones
- Be opinionated. Take a clear stance when the evidence supports it.
- No exclamation marks. No filler: "let's dive in", "it's worth noting", "needless to say"
- No em dashes (U+2014) or en dashes (U+2013) - use a hyphen or rewrite

ABSOLUTE BANNED PATTERNS:
- Never open with: "[Company/Product] just [announced/released/launched]..."
- Never open with: "A [post/thread/article] appeared on..."
- Never open with: "[Something] landed on Hacker News with..."
- Never use these h2 patterns: "What X actually is", "Who this is for", "The broader picture", "What this means for the market", "Final thoughts", "Conclusion"
- No leading spaces in any text
- No h1 tags inside content (the page already has an h1 from the title)
- No full HTML document wrapper (no DOCTYPE, html, head, body tags)

LINKS:
- External: link to the source URL and other relevant external sources
- Internal tools: <a href='/tools/slug'>Tool Name</a>
- Internal comparisons: <a href='/compare/slug'>descriptive anchor text</a>
- Include 2-3 external and 2-3 internal links

IMAGE MARKERS - place 1-2 in the content between sections:
Format: <!-- IMG:topic1,topic2|Alt text describing what the image shows|Optional short caption -->
Topics should describe the visual content (code, team, chart, security, ai, mobile, business, etc.)
Example: <!-- IMG:code,developer|A developer reviewing code on multiple monitors|Writing code that actually scales -->

RICH HTML PATTERNS - use at least 2 of these in every post:

TL;DR box (place at top or after intro):
<div class="blog-tldr"><p>TL;DR</p><p>Two sentence plain-English summary of the key takeaway.</p></div>

Stat highlight (when you have a compelling number):
<div class="blog-stat"><p class="stat-number">47%</p><p class="stat-label">of developers now use AI coding tools daily</p></div>

Pull quote (for a key insight you want to stand alone):
<aside class="blog-pullquote">The tool does not matter. The judgment does.</aside>

Callout/warning box:
<div class="blog-callout"><p>Important</p><p>What the reader must know before proceeding.</p></div>

Code block (for CLI commands, config, or code snippets):
<pre><code>npx claude --model opus "refactor this function"</code></pre>

Inline code: <code>model-name</code> or <code>--flag</code>

Comparison table:
<table><thead><tr><th>Feature</th><th>Tool A</th><th>Tool B</th></tr></thead><tbody><tr><td>Price</td><td>$20/mo</td><td>Free</td></tr></tbody></table>

Blockquote (for direct quotes from announcements, posts, or people):
<blockquote>Exact words from the source, attributed.</blockquote>`;

  const TEMPLATE_BLOCK = `
THIS POST'S STRUCTURE TYPE: ${template.type}
${template.description}

OPENING REQUIREMENT: ${template.openingInstruction}
Your first paragraph MUST follow this opening style exactly.

CLOSING REQUIREMENT: ${template.closingInstruction}

SECTION GUIDANCE: ${template.sectionGuidance}

REQUIRED HTML ELEMENTS - you MUST include ALL of these in your response:
${template.requiredElements.map(el => `- <${el}>`).join('\n')}

Return ONLY the raw HTML string. No JSON wrapper, no markdown code fences, no explanation before or after.`;

  return BASE_RULES + TEMPLATE_BLOCK;
}

async function generateBlogPost(
  client: Anthropic,
  idea: SelectedIdea,
  tools: ToolInfo[],
  comparisonSlugs: string[],
  recentPostSlugs: string[],
  template: StructureTemplate,
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
    // Call 1: meta (slug, title, excerpt)
    const metaMsg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: metaSystemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const metaText = metaMsg.content[0].type === 'text' ? metaMsg.content[0].text : '{}';
    const meta = parseJsonFromResponse(metaText) as { slug: string; title: string; excerpt: string };

    // Call 2: content (raw HTML with template structure)
    const contentMsg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: buildContentSystemPrompt(template),
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

  // Strip any accidentally included h1 tags (convert to h2)
  content = content.replace(/<h1[^>]*>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>');

  // Strip full HTML document wrappers if model included them
  content = content.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<\/?body[^>]*>/gi, '').trim();

  // Strip any unresolved IMG markers (safety net)
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

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - IDEA_FRESHNESS_DAYS);
  const freshIdeas = allIdeas.filter(i => new Date(i.fetchedAt) > cutoff && !publishedUrlSet.has(i.url));

  console.log(`${freshIdeas.length} fresh unpublished ideas available`);
  if (freshIdeas.length < 2) { console.log('Not enough fresh ideas. Skipping generation.'); process.exit(0); }

  const validImages = await getValidPoolIds(usedImageIds);
  const client = new Anthropic({ apiKey });

  let selectedIdeas: SelectedIdea[];
  try {
    selectedIdeas = await selectBestIdeas(client, freshIdeas, existingTitles, tools);
    if (!Array.isArray(selectedIdeas) || selectedIdeas.length === 0) { console.error('Idea selection returned no results.'); process.exit(0); }
    console.log(`Selected: ${selectedIdeas.map(i => i.suggestedSlug).join(', ')}`);
  } catch (err) {
    console.error(`Idea selection failed: ${err}`); process.exit(0);
  }

  const recentPostSlugs = Array.from(existingSlugs).slice(-10);
  const updatedPublishedUrls = [...publishedUrls];
  const usedInlineIds = new Set<string>();
  let generated = 0;

  for (const idea of selectedIdeas.slice(0, MAX_POSTS_PER_RUN)) {
    // Assign template deterministically based on current post count
    const template = STRUCTURE_TEMPLATES[existingSlugs.size % STRUCTURE_TEMPLATES.length];
    console.log(`Generating: "${idea.title}" [template: ${template.type}]...`);

    const raw = await generateBlogPost(client, idea, tools, comparisonSlugs, recentPostSlugs, template);
    if (!raw) continue;

    const validated = validatePost(raw, existingSlugs, tools, comparisonSlugs);
    if (!validated) continue;

    if (validImages.length === 0) { console.error('No valid images available, skipping post.'); continue; }

    // Resolve image markers in content
    const contentWithImages = resolveImageMarkers(validated.content, validImages, usedInlineIds);

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
      content: contentWithImages,
    };

    const outPath = path.join(BLOG_DIR, `${validated.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(post, null, 2));
    existingSlugs.add(validated.slug);

    updatedPublishedUrls.push({ url: idea.url, slug: validated.slug, publishedAt: getToday() });
    appendBotLog(`blog: ${validated.title} -> https://aitoolcrunch.com/blog/${validated.slug}`);
    console.log(`Wrote: data/blog/${validated.slug}.json (${template.type})`);
    generated++;
  }

  savePublishedUrls(updatedPublishedUrls.slice(-500));
  console.log(`Done. Generated ${generated} blog post(s).`);

  console.log('\nEnriching comparison pages...');
  await enrichNewComparisons(client);
}

main().catch(console.error).finally(() => process.exit(0));
