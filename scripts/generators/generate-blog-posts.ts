/**
 * Automated blog post generator for AIToolCrunch.
 *
 * Reads data/blog-ideas.json (populated daily by the blog-ideas scraper),
 * uses Claude Haiku to select the 2 best ideas and generate full blog posts,
 * then writes them to data/blog/{slug}.json.
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

/**
 * Curated pool of tech/AI-themed Unsplash photo IDs.
 * These are validated at runtime via HEAD requests - broken ones are skipped.
 * Add more IDs as the pool runs low.
 */
const UNSPLASH_POOL = [
  '1484480974693-6ca0a78fb36b',
  '1498050108023-c5249f4df085',
  '1517694712202-14dd9538aa97',
  '1531297484001-80022131f5a1',
  '1488229297570-58520851e868',
  '1451187580459-43490279c0fa',
  '1573164713714-d95e436ab8d6',
  '1485827404703-89b55fcc595e',
  '1550751827-4bd374c3f58b',
  '1571171637578-41bc2dd41cd2',
  '1510915228340-29c85a43dcfe',
  '1516116216624-53e697fedbea',
  '1527689368864-3a821dbccc34',
  '1537432376769-00f5c2f4c8d2',
  '1580752300992-559f8e0734e0',
  '1600267175161-cfaa711b4a81',
  '1605792657660-596af9009e82',
  '1629904853716-f0bc54eea481',
  '1639762681485-074b7f938ba0',
  '1655721529003-5e48ce5f5566',
  '1676277791608-f93f87dd91c3',
  '1682687220989-cbf16b25d4f0',
  '1696258686454-60082b2c33e6',
  '1707343843437-caacff5cfa74',
];

const VALID_TAGS = [
  'ai-code', 'ai-trends', 'real-world', 'announcements', 'ai-writing',
  'comparison', 'ai-stories', 'ai-automation', 'how-to', 'ai-business',
  'ai-image', 'ai-audio', 'ai-video',
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
  if (!fs.existsSync(IDEAS_FILE)) {
    console.log('No blog-ideas.json found, skipping.');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8'));
  } catch {
    console.error('Failed to parse blog-ideas.json');
    return [];
  }
}

function loadPublishedUrls(): PublishedUrl[] {
  if (!fs.existsSync(PUBLISHED_URLS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PUBLISHED_URLS_FILE, 'utf-8'));
  } catch { return []; }
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
    } catch { /* skip malformed files */ }
  }

  return { slugs, titles, usedImageIds };
}

function loadTools(): ToolInfo[] {
  if (!fs.existsSync(TOOLS_DIR)) return [];
  return fs.readdirSync(TOOLS_DIR)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => {
      try {
        const tool = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
        return [{ slug: tool.slug as string, name: tool.name as string }];
      } catch { return []; }
    });
}

function loadComparisonSlugs(): string[] {
  if (!fs.existsSync(COMPARISONS_FILE)) return [];
  try {
    return (JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as { slug: string }[])
      .map(c => c.slug);
  } catch { return []; }
}

// ── Image validation ───────────────────────────────────────────────────────────

async function validateUnsplashId(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://images.unsplash.com/photo-${id}?w=100&q=10`,
      { method: 'HEAD', signal: AbortSignal.timeout(5000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function getValidPoolIds(usedImageIds: Set<string>): Promise<string[]> {
  const candidates = UNSPLASH_POOL.filter(id => !usedImageIds.has(id));
  if (candidates.length === 0) return UNSPLASH_POOL; // all used, allow repeats

  // Validate all candidates in parallel
  const results = await Promise.all(
    candidates.map(async id => ({ id, valid: await validateUnsplashId(id) }))
  );

  const valid = results.filter(r => r.valid).map(r => r.id);
  console.log(`Image pool: ${valid.length}/${candidates.length} candidate IDs valid`);

  // Fall back to unvalidated pool if all fail (e.g., network issue in CI)
  return valid.length > 0 ? valid : candidates;
}

function pickCoverImage(validIds: string[]): string {
  const id = validIds[Math.floor(Math.random() * validIds.length)];
  return `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
}

// ── Content helpers ────────────────────────────────────────────────────────────

function cleanContent(html: string): string {
  return html
    .replace(/\u2014/g, '-')  // em dash
    .replace(/\u2013/g, '-')  // en dash
    .replace(/^\s+/gm, '');   // leading whitespace per line
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function parseJsonFromResponse(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned);
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

  const systemPrompt = `You are the editorial director of AIToolCrunch, an AI tools comparison and review website. Your job is to select the 2 best blog post ideas from a list of scraped news items.

The site covers: AI Writing, AI Image, AI Code, AI Video, AI Audio, and AI Automation tools. It features tools like: ${toolNames}.

Selection criteria (in order of importance):
1. Relevance to AI tools the site covers - announcements, updates, comparisons, trends
2. Timeliness - prefer items from the last 48 hours
3. Not a duplicate of an existing post - check existing titles carefully for semantic overlap
4. Has potential for internal links to tools already on the site

Return ONLY a valid JSON array of exactly 2 objects. No markdown fences, no explanation:
[
  {
    "title": "exact scraped item title",
    "url": "exact scraped item url",
    "source": "exact scraped item source",
    "summary": "exact scraped item summary",
    "score": 0,
    "fetchedAt": "exact scraped item fetchedAt",
    "suggestedSlug": "lowercase-hyphenated-slug-max-6-words",
    "suggestedTags": ["tag1", "tag2"],
    "reason": "one sentence why this is a good pick"
  }
]

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

async function generateBlogPost(
  client: Anthropic,
  idea: SelectedIdea,
  tools: ToolInfo[],
  comparisonSlugs: string[],
  recentPostSlugs: string[],
): Promise<GeneratedPost | null> {
  const toolList = tools.map(t => `${t.name} -> /tools/${t.slug}`).join('\n');
  const compList = comparisonSlugs.slice(0, 30).join('\n');
  const recentList = recentPostSlugs.slice(0, 8).map(s => `/blog/${s}`).join('\n');

  const systemPrompt = `You are a staff writer for AIToolCrunch, an AI tools comparison site. Write engaging, varied blog posts that feel genuinely human - not AI-generated content following a template.

TONE AND VOICE:
- Write like a knowledgeable colleague who has actually used these tools and thought carefully about them
- Vary your sentence length dramatically - mix 5-word punchy sentences with longer analytical ones
- You can be opinionated. Take a clear stance when the evidence supports it.
- Avoid detached analyst voice. Speak to the reader directly sometimes.
- No exclamation marks. No filler: "let's dive in", "it's worth noting", "needless to say", "in this post we will"
- No em dashes or en dashes - use a hyphen or rewrite

STRUCTURE - VARY THIS EVERY POST:
- Do NOT follow a template. Each post should feel like it was written for that specific story.
- Opening: start with the most interesting/surprising thing about the story. Never "X landed on HN with Y points". Never a question opener.
- 4-7 sections with <h2> headings. Make headings specific and opinionated, not generic ("The $200 question nobody's answering" not "Pricing")
- Mix paragraph lengths: some 1-2 sentence punchy ones, some 4-5 sentence analytical ones
- End with something concrete - a takeaway, a prediction, a specific recommendation - not a vague market-implications paragraph

HTML - USE RICH FORMATTING where it genuinely helps:
- <p> for body paragraphs (main tag)
- <h2> for major sections
- <h3> for sub-points within a section when useful
- <strong> to emphasize a key term or surprising fact (use sparingly - max 3-4 per post)
- <ul><li> for genuine lists (features, steps, options) - not as a lazy alternative to prose
- <ol><li> for ranked lists or sequential steps
- <blockquote> when you are quoting a specific person, post, or announcement verbatim
- <table><thead><tbody><tr><th><td> for side-by-side data comparisons (pricing, benchmarks, specs)
- <code> for command-line snippets, model names used as code, config values
- <a href="..."> for links - both internal AND external

LINKS - BOTH INTERNAL AND EXTERNAL:
- External links: link directly to the source being discussed (the HN thread, the announcement post, the Reddit thread, the GitHub repo). Use the URL from the news item.
- Internal tool links: <a href='/tools/slug'>Tool Name</a>
- Internal comparison links: <a href='/compare/slug'>descriptive text</a>
- Internal blog links: <a href='/blog/slug'>descriptive text</a>
- Include 2-3 external links and 2-3 internal links per post

CONTENT VARIETY - pick the approach that fits the story:
- For a product launch: lead with what's actually new, not the announcement itself
- For a trend/analysis piece: open with a concrete data point or observation, build to a thesis
- For a "how-to" story: use numbered steps or a clear before/after structure
- For a comparison angle: use a table or direct side-by-side structure
- For a community story (HN, Reddit): quote the most interesting comment or reaction using <blockquote>
- For pricing/cost stories: use a table showing the numbers directly

ABSOLUTE RULES:
- Never start a post: "X landed on Hacker News with Y points" or any variation
- Never use these h2 patterns: "What X actually is", "Who this is for", "The broader picture", "What this means for the market"
- No em dashes (U+2014) or en dashes (U+2013) anywhere
- No leading spaces in any text
- Author is set externally - do not include it

Return ONLY valid JSON with absolutely no markdown code fences:
{"slug":"lowercase-hyphenated-max-6-words","title":"Title Under 70 Characters","excerpt":"1-2 sentence direct summary, informative not clickbait","content":"<full HTML content>"}`;

  const userPrompt = `Write a blog post based on this news item.

Title: ${idea.title}
Source URL (use this for external links in the post): ${idea.url}
Source: ${idea.source}
Summary: ${idea.summary}
Suggested slug: ${idea.suggestedSlug}

Available tools for internal links (Name -> /tools/slug):
${toolList}

Available comparison pages (/compare/slug):
${compList}

Recent posts for cross-linking (/blog/slug):
${recentList}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return parseJsonFromResponse(text) as GeneratedPost;
  } catch (err) {
    console.error(`Generation failed for "${idea.title}": ${err}`);
    return null;
  }
}

// ── Comparison body generator ──────────────────────────────────────────────────

interface ComparisonEntry {
  slug: string;
  toolA: string;
  toolB: string;
  title?: string;
  verdict?: string;
  winner?: string;
  body?: string;
}

interface FullToolData {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  pros: string[];
  cons: string[];
  pricing: { hasFree: boolean; startingPrice: string | null; plans: { name: string; price: string; features: string[] }[] };
  bestFor?: string;
  keyStrength?: string;
  category: string[];
}

function loadFullTool(slug: string): FullToolData | null {
  const file = path.join(process.cwd(), 'data', 'tools', `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

async function generateComparisonBody(
  client: Anthropic,
  comp: ComparisonEntry,
): Promise<string | null> {
  const toolA = loadFullTool(comp.toolA);
  const toolB = loadFullTool(comp.toolB);
  if (!toolA || !toolB) return null;

  const systemPrompt = `You are a staff writer for AIToolCrunch, an AI tools comparison site. Write a rich editorial comparison section in HTML.

This will appear on a comparison page that already has: a side-by-side specs table, a verdict box, and both tools' pros/cons lists. Do NOT repeat those elements.

Instead write 500-800 words of editorial content covering:
- The most important practical difference between the two tools (not just specs - the real day-to-day difference)
- Specific use cases where each tool clearly wins
- Pricing reality - not just the numbers, but what you actually get at each tier
- One specific scenario or type of user who should choose each tool

HTML allowed: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>
- Use <h2> for 2-3 major sections
- Use <ul><li> for genuine lists
- Use <table> if comparing specific features or pricing tiers side by side
- Use <strong> for key differences (sparingly)
- No em dashes, no en dashes, no exclamation marks, no leading spaces
- No generic headings like "Overview", "Introduction", "Final Thoughts"
- Do NOT include a verdict or recommendation - that's in a separate section

Return ONLY the raw HTML string. No JSON wrapper, no markdown fences.`;

  const userPrompt = `Write the editorial body for this comparison page.

${toolA.name} vs ${toolB.name}

${toolA.name}:
- Tagline: ${toolA.tagline}
- Best for: ${toolA.bestFor ?? 'not specified'}
- Key strength: ${toolA.keyStrength ?? 'not specified'}
- Starting price: ${toolA.pricing.startingPrice ?? 'free'}
- Has free plan: ${toolA.pricing.hasFree}
- Top features: ${toolA.features.slice(0, 5).join(', ')}
- Pros: ${toolA.pros.join(', ')}
- Cons: ${toolA.cons.join(', ')}

${toolB.name}:
- Tagline: ${toolB.tagline}
- Best for: ${toolB.bestFor ?? 'not specified'}
- Key strength: ${toolB.keyStrength ?? 'not specified'}
- Starting price: ${toolB.pricing.startingPrice ?? 'free'}
- Has free plan: ${toolB.pricing.hasFree}
- Top features: ${toolB.features.slice(0, 5).join(', ')}
- Pros: ${toolB.pros.join(', ')}
- Cons: ${toolB.cons.join(', ')}

Category: ${toolA.category.join(', ')}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return cleanContent(text.trim());
  } catch (err) {
    console.error(`Comparison body generation failed for ${comp.slug}: ${err}`);
    return null;
  }
}

async function enrichNewComparisons(client: Anthropic): Promise<void> {
  if (!fs.existsSync(COMPARISONS_FILE)) return;

  let comparisons: ComparisonEntry[];
  try {
    comparisons = JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8'));
  } catch { return; }

  // Find comparisons that have no body yet - process up to 5 per run to limit API cost
  const needsBody = comparisons.filter(c => !c.body).slice(0, 5);
  if (needsBody.length === 0) {
    console.log('All comparisons already have body content.');
    return;
  }

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

// ── Validation ─────────────────────────────────────────────────────────────────

function validatePost(
  post: GeneratedPost,
  existingSlugs: Set<string>,
  tools: ToolInfo[],
  comparisonSlugs: string[],
): GeneratedPost | null {
  if (!post.slug || !/^[a-z0-9-]+$/.test(post.slug)) {
    console.error(`Invalid slug format: "${post.slug}"`);
    return null;
  }
  if (existingSlugs.has(post.slug)) {
    console.log(`Skipping duplicate slug: ${post.slug}`);
    return null;
  }
  if (!post.content || post.content.length < 500) {
    console.error(`Content too short for: ${post.slug} (${post.content?.length ?? 0} chars)`);
    return null;
  }
  if (!post.content.includes('<h2>') || !post.content.includes('<p>')) {
    console.error(`Content missing required HTML structure: ${post.slug}`);
    return null;
  }

  const cleanedContent = cleanContent(post.content);

  // Validate internal links - replace broken ones with homepage
  const toolSlugs = new Set(tools.map(t => t.slug));
  const compSlugs = new Set(comparisonSlugs);

  const validatedContent = cleanedContent.replace(
    /href='(\/(?:tools|compare|blog)\/[^']+)'/g,
    (match, href) => {
      const parts = href.split('/');
      const type = parts[1];
      const slug = parts[2];
      if (type === 'tools' && !toolSlugs.has(slug)) return `href='/'`;
      if (type === 'compare' && !compSlugs.has(slug)) return `href='/'`;
      return match;
    }
  );

  return {
    slug: post.slug,
    title: post.title.trim(),
    excerpt: post.excerpt.trim(),
    content: validatedContent,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set, skipping blog post generation.');
    process.exit(0);
  }

  console.log('Starting automated blog post generation...');

  const allIdeas = loadBlogIdeas();
  const publishedUrls = loadPublishedUrls();
  const publishedUrlSet = new Set(publishedUrls.map(p => p.url));

  const { slugs: existingSlugs, titles: existingTitles, usedImageIds } = loadExistingPosts();
  const tools = loadTools();
  const comparisonSlugs = loadComparisonSlugs();

  // Filter: fresh AND not already published (by source URL)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - IDEA_FRESHNESS_DAYS);
  const freshIdeas = allIdeas.filter(
    i => new Date(i.fetchedAt) > cutoff && !publishedUrlSet.has(i.url)
  );

  console.log(`${freshIdeas.length} fresh unpublished ideas available`);

  if (freshIdeas.length < 2) {
    console.log('Not enough fresh ideas. Skipping generation.');
    process.exit(0);
  }

  // Validate image pool upfront
  const validImageIds = await getValidPoolIds(usedImageIds);

  const client = new Anthropic({ apiKey });

  // Step 1: Select the best ideas
  let selectedIdeas: SelectedIdea[];
  try {
    selectedIdeas = await selectBestIdeas(client, freshIdeas, existingTitles, tools);
    if (!Array.isArray(selectedIdeas) || selectedIdeas.length === 0) {
      console.error('Idea selection returned no results.');
      process.exit(0);
    }
    console.log(`Selected: ${selectedIdeas.map(i => i.suggestedSlug).join(', ')}`);
  } catch (err) {
    console.error(`Idea selection failed: ${err}`);
    process.exit(0);
  }

  const recentPostSlugs = Array.from(existingSlugs).slice(-10);
  const updatedPublishedUrls = [...publishedUrls];

  // Step 2: Generate posts
  let generated = 0;
  for (const idea of selectedIdeas.slice(0, MAX_POSTS_PER_RUN)) {
    console.log(`Generating: "${idea.title}"...`);

    const raw = await generateBlogPost(client, idea, tools, comparisonSlugs, recentPostSlugs);
    if (!raw) continue;

    const validated = validatePost(raw, existingSlugs, tools, comparisonSlugs);
    if (!validated) continue;

    if (validImageIds.length === 0) {
      console.error('No valid images available, skipping post.');
      continue;
    }

    const coverImage = pickCoverImage(validImageIds);
    const imageId = coverImage.match(/photo-([a-zA-Z0-9_-]+)/)?.[1];
    if (imageId) {
      usedImageIds.add(imageId);
      // Remove used ID from valid pool to avoid repeat in same run
      const idx = validImageIds.indexOf(imageId);
      if (idx !== -1) validImageIds.splice(idx, 1);
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

    // Track published source URL to prevent future re-selection
    updatedPublishedUrls.push({
      url: idea.url,
      slug: validated.slug,
      publishedAt: getToday(),
    });

    // Write to bot log for commit message
    appendBotLog(`blog: ${validated.title} -> https://aitoolcrunch.com/blog/${validated.slug}`);

    console.log(`Wrote: data/blog/${validated.slug}.json`);
    generated++;
  }

  // Persist updated URL list (keep last 500)
  savePublishedUrls(updatedPublishedUrls.slice(-500));

  console.log(`Done. Generated ${generated} blog post(s).`);

  // Step 3: Enrich comparisons that have no body content yet (5 per run)
  console.log('\nEnriching comparison pages...');
  await enrichNewComparisons(client);
}

main().catch(console.error).finally(() => process.exit(0));
