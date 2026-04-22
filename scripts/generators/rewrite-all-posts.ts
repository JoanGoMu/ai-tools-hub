/**
 * One-shot script: rewrite all existing blog posts using the new approach.
 *
 * - Rewrites content for all posts using Sonnet 4.6 + the new system prompt
 * - Random structure per post (no fixed templates)
 * - Banned-pattern scanner + quality rewrite pass on violations
 * - Fixes author to "AIToolCrunch" on posts with fake individual names
 * - Keeps: slug, title, excerpt, tags, publishedAt, coverImage
 *
 * Run: ANTHROPIC_API_KEY=... npx tsx scripts/generators/rewrite-all-posts.ts
 * Cost: ~$0.05 per post * 48 posts = ~$2.40
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { scanForViolations, hasBannedContent, getBannedPhrasesForPrompt } from './lib/banned-patterns.js';
import { generateStructure, structureToPromptBlock } from './lib/structure-generator.js';
import { loadHistory, saveToHistory, buildAvoidancePrompt } from './lib/anti-repetition.js';
import { critiqueAndRewrite } from './lib/quality-pass.js';

const BLOG_DIR = path.join(process.cwd(), 'data', 'blog');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');

// ── Style seeds (same as generator) ───────────────────────────────────────────
const STYLE_SEEDS = `REFERENCE WRITING QUALITY - match this level of specificity and naturalness:

Example 1 (direct, analytical):
"The gap between what a tool promises and what it delivers in practice is usually a pricing decision. Anthropic's Claude can write code. So can GPT-4. The difference is not capability - both will produce working Python for most tasks - it is where each system breaks down. Claude tends to be more careful with long context. GPT-4 tends to be faster at short turnaround tasks. Neither is universally better. The question is which failure mode costs you less."

Example 2 (concrete, specific):
"I tested three AI video tools on the same script last week. Synthesia produced the avatar in 14 minutes. HeyGen took 9. Runway took 3, but the output needed two rounds of correction. Time to usable output, not time to first render, is the number that matters for production workflows."

Example 3 (measured, with appropriate nuance):
"There is a version of the 'AI will replace developers' argument that is wrong in an interesting way. It is not that AI cannot write code - it clearly can. It is that writing code was never the bottleneck. The bottleneck is knowing what to build, catching what is wrong, and maintaining what exists. Those tasks have not gotten faster."`;

interface ToolInfo { slug: string; name: string; }
interface BlogPost {
  slug: string; title: string; excerpt: string; content: string;
  author: string; publishedAt: string; tags: string[];
  status: string; featured: boolean; coverImage?: string;
}

function loadTools(): ToolInfo[] {
  if (!fs.existsSync(TOOLS_DIR)) return [];
  return fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json')).flatMap(f => {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
      return [{ slug: t.slug as string, name: t.name as string }];
    } catch { return []; }
  });
}

function loadComparisonSlugs(): string[] {
  if (!fs.existsSync(COMPARISONS_FILE)) return [];
  try { return (JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as { slug: string }[]).map(c => c.slug); }
  catch { return []; }
}

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
    } catch { /* raw HTML */ }
  }
  return stripped;
}

function buildSystemPrompt(avoidancePrompt: string, structureBlock: string): string {
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
- Internal tool links: <a href='/tools/slug'>Tool Name</a>
- Internal comparison links: <a href='/compare/slug'>descriptive anchor text</a>
- Include 2-3 internal links total

IMAGES:
- Place exactly 1 inline image marker somewhere in the body between two sections where it fits the topic.
- Format: <!-- IMG:topic1,topic2|Alt text describing what the image shows in context|Caption that explains why this image is here and what it illustrates -->
- The caption must be specific to THIS post's topic. Bad: "A developer at a computer". Good: "Token usage breakdown across a Claude Code session with multiple file edits"
- Pick topics from: code, developer, laptop, screen, monitor, ai, robot, technology, data, network, chart, analytics, business, team, meeting, office, writing, creativity, mobile, security, abstract
- Do not use "visual break" or anything decorative.

AVAILABLE HTML ELEMENTS (use only what serves this specific content):
- TL;DR box: <div class="blog-tldr"><p>TL;DR</p><p>Summary here.</p></div>
- Stat highlight: <div class="blog-stat"><p class="stat-number">47%</p><p class="stat-label">label</p></div>
- Pull quote: <aside class="blog-pullquote">Key insight that stands alone.</aside>
- Callout box: <div class="blog-callout"><p>Heading</p><p>Important detail.</p></div>
- Code block: <pre><code>command or snippet</code></pre>
- Inline code: <code>term</code>
- Table: <table><thead>...</thead><tbody>...</tbody></table>
- Blockquote: <blockquote>Direct quote with source.</blockquote>
- No h1 tags. No full HTML document wrapper.

${structureBlock}`;
}

function validateContent(content: string, tools: ToolInfo[], comparisonSlugs: string[]): string {
  let c = cleanContent(content);
  c = c.replace(/<h1[^>]*>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>');
  c = c.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<\/?body[^>]*>/gi, '').trim();
  c = c.replace(/<!--\s*IMG:[^>]*-->/gi, '');

  const toolSlugs = new Set(tools.map(t => t.slug));
  const compSlugs = new Set(comparisonSlugs);
  c = c.replace(/href='(\/(?:tools|compare|blog)\/[^']+)'/g, (match, href) => {
    const parts = href.split('/');
    const type = parts[1]; const slug = parts[2];
    if (type === 'tools' && !toolSlugs.has(slug)) return `href='/'`;
    if (type === 'compare' && !compSlugs.has(slug)) return `href='/'`;
    return match;
  });
  return c;
}

async function rewritePost(
  client: Anthropic,
  post: BlogPost,
  tools: ToolInfo[],
  comparisonSlugs: string[],
  avoidancePrompt: string,
): Promise<string | null> {
  const toolList = tools.map(t => `${t.name} -> /tools/${t.slug}`).join('\n');
  const compList = comparisonSlugs.slice(0, 30).join('\n');

  const structure = generateStructure(loadHistory().recentStructures);
  const structureBlock = structureToPromptBlock(structure);

  const userPrompt = `Write a blog post on this topic for AIToolCrunch.

Post title: ${post.title}
Summary/excerpt: ${post.excerpt}
Tags: ${post.tags.join(', ')}

Available tools for internal links (Name -> /tools/slug):
${toolList}

Available comparison pages (/compare/slug):
${compList}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: buildSystemPrompt(avoidancePrompt, structureBlock),
      messages: [{ role: 'user', content: userPrompt }],
    });
    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    let content = extractHtmlContent(raw);

    if (!content || content.length < 500) {
      console.error(`  Content too short (${content.length} chars), skipping`);
      return null;
    }

    // Quality scan + rewrite pass
    if (hasBannedContent(content)) {
      const violations = scanForViolations(content);
      console.log(`  Violations: ${violations.phrases.length} phrases, ${violations.h2s.length} H2s. Rewriting...`);
      content = await critiqueAndRewrite(client, content, violations);
    }

    content = validateContent(content, tools, comparisonSlugs);
    return content;
  } catch (err) {
    console.error(`  API error: ${err}`);
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  const client = new Anthropic({ apiKey });
  const tools = loadTools();
  const comparisonSlugs = loadComparisonSlugs();

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.json')).sort();
  console.log(`Found ${files.length} blog posts to rewrite`);

  let rewritten = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(BLOG_DIR, file);

    let post: BlogPost;
    try {
      post = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      console.error(`Failed to parse ${file}, skipping`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${files.length}] ${post.slug}`);

    const history = loadHistory();
    const avoidancePrompt = buildAvoidancePrompt(history);

    const newContent = await rewritePost(client, post, tools, comparisonSlugs, avoidancePrompt);

    if (!newContent) {
      console.log(`  FAILED - keeping original`);
      failed++;
      // Brief pause even on failure
      await sleep(500);
      continue;
    }

    // Update post: fix author, update content
    const updated: BlogPost = {
      ...post,
      author: 'AIToolCrunch',
      content: newContent,
    };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

    // Save to anti-repetition history
    saveToHistory({ slug: post.slug, title: post.title, content: newContent }, generateStructure([]));

    console.log(`  OK (${newContent.length} chars)`);
    rewritten++;

    // Brief pause between API calls to avoid rate limits
    if (i < files.length - 1) await sleep(800);
  }

  console.log(`\nDone. Rewritten: ${rewritten}, Failed: ${failed}, Skipped: ${skipped}`);
}

main().catch(console.error).finally(() => process.exit(0));
