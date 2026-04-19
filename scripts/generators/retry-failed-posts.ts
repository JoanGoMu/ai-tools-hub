/**
 * Retries the 5 blog posts that failed due to JSON escaping issues.
 * Uses a split-response approach: Claude returns title/excerpt as JSON,
 * then content as raw HTML in a separate call.
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const BLOG_DIR = path.join(process.cwd(), 'data', 'blog');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');

const FAILED_SLUGS = [
  'claude-design-anthropic-labs',
  'coding-agent-infrastructure-freestyle-twill',
  'microsoft-copilot-naming-confusion',
  'qwen-3-6-open-source-beats-opus',
  'taste-in-the-age-of-ai',
];

function cleanContent(html: string): string {
  return html
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/^\s+/gm, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadTools() {
  return fs.readdirSync(TOOLS_DIR)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
        return [`${t.name} -> /tools/${t.slug}`];
      } catch { return []; }
    }).join('\n');
}

function loadComparisonSlugs() {
  if (!fs.existsSync(COMPARISONS_FILE)) return '';
  try {
    return (JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as { slug: string }[])
      .slice(0, 30).map(c => c.slug).join('\n');
  } catch { return ''; }
}

const SYSTEM_META = `You are a staff writer for AIToolCrunch. Given a blog post to rewrite, return ONLY a JSON object with title and excerpt. No content, no markdown fences.
{"title":"Under 70 chars","excerpt":"1-2 sentence direct summary"}`;

const SYSTEM_CONTENT = `You are a staff writer for AIToolCrunch. Rewrite this blog post as rich HTML. Return ONLY the raw HTML - no JSON wrapper, no markdown fences, no explanation.

Rules:
- Varied HTML: use <p>, <h2>, <h3>, <strong>, <ul><li>, <ol><li>, <blockquote>, <table> where they genuinely help
- Varied structure - don't follow a template, pick what fits the story
- No "X landed on HN with Y points" openers
- No h2 patterns: "What X actually is", "Who this is for", "The broader picture"
- No em dashes (use hyphen), no leading spaces, no exclamation marks
- Include external links to sources and 2-3 internal links
- Internal tool links: <a href='/tools/slug'>Name</a>
- 800-1200 words, opinionated voice, varied sentence length`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
  const client = new Anthropic({ apiKey });

  const toolList = loadTools();
  const compList = loadComparisonSlugs();

  for (let i = 0; i < FAILED_SLUGS.length; i++) {
    const slug = FAILED_SLUGS[i];
    const filePath = path.join(BLOG_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) { console.log(`Skipping ${slug} - file not found`); continue; }

    const post = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`[${i + 1}/${FAILED_SLUGS.length}] ${slug}`);

    const context = `Current title: ${post.title}\nCurrent excerpt: ${post.excerpt}\nCurrent content:\n${post.content}\n\nAvailable tools:\n${toolList}\n\nAvailable comparisons:\n${compList}`;

    try {
      // Call 1: get title + excerpt as simple JSON (no HTML, no escaping issues)
      const metaMsg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system: SYSTEM_META,
        messages: [{ role: 'user', content: context }],
      });
      const metaText = metaMsg.content[0].type === 'text' ? metaMsg.content[0].text : '{}';
      const meta = JSON.parse(metaText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()) as { title: string; excerpt: string };

      await sleep(500);

      // Call 2: get content as raw HTML (no JSON wrapper, no escaping issues)
      const contentMsg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: SYSTEM_CONTENT,
        messages: [{ role: 'user', content: context }],
      });
      const rawContent = contentMsg.content[0].type === 'text' ? contentMsg.content[0].text : '';
      const content = cleanContent(rawContent.trim());

      if (!content.includes('<p>') || content.length < 500) {
        console.error(`  Content too short or missing structure, skipping`);
        continue;
      }

      const updated = { ...post, title: meta.title || post.title, excerpt: meta.excerpt || post.excerpt, content };
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      console.log(`  Done.`);
    } catch (err) {
      console.error(`  Failed: ${err}`);
    }

    if (i < FAILED_SLUGS.length - 1) await sleep(1000);
  }

  console.log('\nDone. Run: git add data/blog/ && git commit && git push');
}

main().catch(console.error).finally(() => process.exit(0));
