/**
 * One-shot script to rewrite the 14 most recent blog posts with varied
 * structure templates and embedded images. Run once then delete.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx scripts/generators/rewrite-recent-posts.ts
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const BLOG_DIR = path.join(process.cwd(), 'data', 'blog');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');

// ── 14 posts to rewrite, each assigned a specific template ────────────────────

const REWRITES: { slug: string; template: string }[] = [
  { slug: 'codeburn-claude-code-token-analysis',          template: 'deep-dive' },
  { slug: 'claude-opus-system-prompt-changes',            template: 'news-reaction' },
  { slug: 'claudraband-claude-code-power-user-tools',     template: 'listicle' },
  { slug: 'taste-in-the-age-of-ai',                       template: 'opinion' },
  { slug: 'microsoft-copilot-naming-confusion',           template: 'comparison' },
  { slug: 'coding-agent-infrastructure-freestyle-twill',  template: 'how-to' },
  { slug: 'claude-design-analysis-review',                template: 'news-reaction' },
  { slug: 'qwen-vs-claude-local-models',                  template: 'opinion' },
  { slug: 'qwen-3-6-open-source-beats-opus',              template: 'deep-dive' },
  { slug: 'claude-design-anthropic-labs',                 template: 'comparison' },
  { slug: 'running-gemma-4-locally-lm-studio-claude-code', template: 'how-to' },
  { slug: 'reallocating-claude-code-spend-zed-openrouter', template: 'listicle' },
  { slug: 'openai-codex-2-claude-code-competitor',        template: 'comparison' },
  { slug: 'nouscoder-14b-open-source-coding-model',       template: 'deep-dive' },
];

// ── Structure templates (mirrored from generate-blog-posts.ts) ────────────────

const TEMPLATES: Record<string, { description: string; requiredElements: string[]; openingInstruction: string; closingInstruction: string; sectionGuidance: string }> = {
  'news-reaction': {
    description: 'Lead with the single most surprising fact from the news. 4-5 h2 sections analyzing what it means. Include a direct quote or announcement text in a blockquote.',
    requiredElements: ['blockquote'],
    openingInstruction: 'Open with the most surprising or counterintuitive fact from this story. Not "Company X announced Y" - the actual interesting thing about what was announced.',
    closingInstruction: 'End with a specific, falsifiable prediction about what happens next (something that will be proven right or wrong within 6 months).',
    sectionGuidance: 'Sections: [The fact that changes things] -> [What it actually means] -> [Who loses, who wins] -> [The prediction]. Use a blockquote for a key quote or notable reaction.',
  },
  'deep-dive': {
    description: 'Technical depth with h3 sub-sections under each h2. 3-4 h2 sections, each broken into 2-3 h3 sub-points. Include code or command examples.',
    requiredElements: ['h3', 'code'],
    openingInstruction: 'Open with a specific technical observation, number, or benchmark result - something concrete that a developer would find immediately useful or alarming.',
    closingInstruction: 'End with a TL;DR box using: <div class="blog-tldr"><p>TL;DR</p><p>Two sentence summary of the technical situation and what to do about it.</p></div>',
    sectionGuidance: 'Use h2 for major themes, h3 for specific technical sub-points. Include at least one <code> snippet. Structure: [Technical setup] -> [How it actually works] -> [Gotchas and edge cases] -> [TL;DR].',
  },
  'listicle': {
    description: '5-7 numbered or ranked items as the spine of the post. Each item is an h2. Use an opening claim, structured list, then synthesis.',
    requiredElements: ['ol'],
    openingInstruction: 'Open with a bold claim about what most people get wrong about this topic.',
    closingInstruction: 'End with a ranked recommendation table showing which item different reader types should prioritize.',
    sectionGuidance: 'After intro, use numbered h2 sections (e.g. "1. The context window problem"). Each gets 2-3 paragraphs. At least one item includes an ordered list inside it. Close with a summary table.',
  },
  'comparison': {
    description: 'Direct side-by-side analysis. Must include a comparison table. 3-4 h2 sections framing from different angles.',
    requiredElements: ['table'],
    openingInstruction: 'Open with the specific decision the reader is trying to make - frame it as "you are choosing between X and Y because Z." Do not start with company names.',
    closingInstruction: 'End with a recommendation matrix table: rows = user type, columns = which tool wins and why.',
    sectionGuidance: 'Sections: [The decision framing] -> [Where they differ in practice] -> [Pricing reality] -> [Recommendation matrix table]. Table must have real data.',
  },
  'how-to': {
    description: 'Practical step-by-step guide. Numbered steps are the backbone. Code blocks for commands. Concrete before/after framing.',
    requiredElements: ['ol', 'code'],
    openingInstruction: 'Open with the exact problem the reader has right now - be specific about the symptom, not the solution.',
    closingInstruction: 'End with a short checklist of things to verify after following the guide, as an unordered list under "Quick Verification Checklist".',
    sectionGuidance: 'Structure: [The problem] -> [Why most solutions fail] -> [Step-by-step guide with <ol> and <code>] -> [Verification checklist].',
  },
  'opinion': {
    description: 'Strong editorial stance. Take a clear position and defend it. Use pull quotes for key claims. 4-5 h2 sections building the argument.',
    requiredElements: ['blockquote'],
    openingInstruction: 'Open with a contrarian claim or a question that challenges something the target reader probably believes.',
    closingInstruction: 'End with a direct challenge or call to action for the reader - something specific they should do or think differently about this week.',
    sectionGuidance: 'Build argument progressively: [The claim] -> [The evidence people ignore] -> [The steelmanned counterargument] -> [Why the counterargument fails] -> [The direct challenge]. Use <aside class="blog-pullquote"> for 1-2 key claims.',
  },
};

// ── Tagged image pool ─────────────────────────────────────────────────────────

interface TaggedImage { id: string; topics: string[]; }

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
  { id: '1432888498266-38ffec3eaf0a', topics: ['writing', 'notebook', 'creativity'] },
  { id: '1543269865-cbf427effbad', topics: ['team', 'collaboration', 'office'] },
  { id: '1526374965328-7f61d4dc18c5', topics: ['code', 'matrix', 'digital'] },
  { id: '1454165804606-c3d57bc86b40', topics: ['business', 'work', 'laptop'] },
  { id: '1581091226825-a6a2a5aee158', topics: ['technology', 'developer', 'code'] },
  { id: '1593642632559-0c6d3fc62b89', topics: ['remote', 'work', 'laptop'] },
  { id: '1614064641938-2de3ccf3a7b4', topics: ['ai', 'circuit', 'chip'] },
  { id: '1563986768609-322da13575f3', topics: ['security', 'lock', 'protection'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function cleanContent(html: string): string {
  return html.replace(/\u2014/g, '-').replace(/\u2013/g, '-').replace(/^\s+/gm, '');
}

function extractHtmlContent(raw: string): string {
  const stripped = raw.replace(/^```(?:json|html|javascript|typescript)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  if (stripped.startsWith('{')) {
    try {
      const parsed = JSON.parse(stripped) as { content?: string };
      if (parsed.content && parsed.content.length > 100) return parsed.content;
    } catch { /* treat as raw HTML */ }
  }
  return stripped;
}

function parseJsonFromResponse(text: string): unknown {
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim());
}

function pickInlineImage(pool: TaggedImage[], topics: string[], usedIds: Set<string>): TaggedImage | null {
  const available = pool.filter(img => !usedIds.has(img.id));
  if (available.length === 0) return pool[0] ?? null;
  const topicsLower = topics.map(t => t.toLowerCase());
  const scored = available.map(img => ({ img, score: img.topics.filter(t => topicsLower.includes(t)).length }));
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0].score;
  const topMatches = topScore > 0 ? scored.filter(s => s.score === topScore) : scored.slice(0, 5);
  return topMatches[Math.floor(Math.random() * topMatches.length)].img;
}

function resolveImageMarkers(content: string, pool: TaggedImage[], usedInlineIds: Set<string>): string {
  let resolved = content;
  const hasMarker = /<!--\s*IMG:/i.test(resolved);
  if (!hasMarker) {
    let count = 0;
    resolved = resolved.replace(/<\/h2>/gi, (match) => {
      count++;
      return count === 2 ? `${match}\n<!-- IMG:technology,code|Visual context for this section|-->` : match;
    });
  }
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

function loadTools(): string {
  return fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json')).flatMap(f => {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8'));
      return [`${t.name} -> /tools/${t.slug}`];
    } catch { return []; }
  }).join('\n');
}

function loadComparisonSlugs(): string {
  if (!fs.existsSync(COMPARISONS_FILE)) return '';
  try {
    return (JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as { slug: string }[])
      .slice(0, 30).map(c => c.slug).join('\n');
  } catch { return ''; }
}

function buildContentSystemPrompt(templateKey: string): string {
  const t = TEMPLATES[templateKey];
  const BASE = `You are a staff writer for AIToolCrunch, an AI tools comparison site. Rewrite this blog post to make it genuinely varied and interesting - not a template being filled in.

TONE AND VOICE:
- Write like a knowledgeable colleague who has used these tools
- Vary sentence length - mix short punchy sentences with longer analytical ones
- Be opinionated. Take clear stances.
- No exclamation marks. No filler phrases.
- No em dashes (U+2014) or en dashes (U+2013) - use a hyphen or rewrite
- Keep the same factual content, links, and key points from the original post

ABSOLUTE BANNED PATTERNS:
- Never open with: "[Company/Product] just [announced/released/launched]..."
- Never open with: "A [post/thread/article] appeared on..."
- Never use these h2 patterns: "What X actually is", "Who this is for", "The broader picture", "What this means for the market", "Final thoughts", "Conclusion"
- No leading spaces in any text
- No h1 tags inside content (the page already has an h1 from the title)
- No full HTML document wrapper (no DOCTYPE, html, head, body tags)

LINKS: Keep all existing internal tool links (/tools/slug) and comparison links (/compare/slug). Keep the external source link.

IMAGE MARKERS - place 1-2 in the content between sections:
Format: <!-- IMG:topic1,topic2|Alt text describing the image|Optional caption -->
Topics (describe visual content): code, developer, team, chart, security, ai, mobile, business, writing, network
Example: <!-- IMG:code,developer|Developer reviewing code on multiple monitors|Code review workflow -->

RICH HTML PATTERNS - use at least 2 in every post:

TL;DR box:
<div class="blog-tldr"><p>TL;DR</p><p>Two sentence summary.</p></div>

Stat highlight:
<div class="blog-stat"><p class="stat-number">47%</p><p class="stat-label">of developers now use AI coding tools daily</p></div>

Pull quote:
<aside class="blog-pullquote">The tool does not matter. The judgment does.</aside>

Callout box:
<div class="blog-callout"><p>Important</p><p>What the reader must know.</p></div>

Code block:
<pre><code>npx claude --model opus "refactor this"</code></pre>

Inline code: <code>model-name</code> or <code>--flag</code>

Comparison table:
<table><thead><tr><th>Feature</th><th>Tool A</th><th>Tool B</th></tr></thead><tbody><tr><td>Price</td><td>$20/mo</td><td>Free</td></tr></tbody></table>

Blockquote:
<blockquote>Exact words from the source.</blockquote>`;

  const TEMPLATE_BLOCK = `

THIS POST'S STRUCTURE TYPE: ${templateKey}
${t.description}

OPENING REQUIREMENT: ${t.openingInstruction}
Your first paragraph MUST follow this opening style.

CLOSING REQUIREMENT: ${t.closingInstruction}

SECTION GUIDANCE: ${t.sectionGuidance}

REQUIRED HTML ELEMENTS - you MUST include ALL of these:
${t.requiredElements.map(el => `- <${el}>`).join('\n')}

Return ONLY the raw HTML string. No JSON wrapper, no markdown fences, no explanation.`;

  return BASE + TEMPLATE_BLOCK;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
  const client = new Anthropic({ apiKey });

  const toolList = loadTools();
  const compList = loadComparisonSlugs();
  const usedInlineIds = new Set<string>();

  let success = 0;
  let failed = 0;

  for (let i = 0; i < REWRITES.length; i++) {
    const { slug, template: templateKey } = REWRITES[i];
    const filePath = path.join(BLOG_DIR, `${slug}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`[${i + 1}/${REWRITES.length}] SKIP ${slug} - file not found`);
      continue;
    }

    const post = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`[${i + 1}/${REWRITES.length}] Rewriting: ${slug} [${templateKey}]`);

    const context = `Original title: ${post.title}
Original excerpt: ${post.excerpt}
Original content:
${post.content}

Available tools for internal links:
${toolList}

Available comparisons:
${compList}`;

    try {
      // Call 1: meta (title + excerpt only)
      const metaMsg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system: `You are an editor for AIToolCrunch. Given a blog post to rewrite, return ONLY a JSON object with title and excerpt. No content, no markdown fences. No em dashes.
{"title":"Under 70 chars","excerpt":"1-2 sentence direct summary, no em dashes"}`,
        messages: [{ role: 'user', content: context }],
      });
      const metaText = metaMsg.content[0].type === 'text' ? metaMsg.content[0].text : '{}';
      const meta = parseJsonFromResponse(metaText) as { title?: string; excerpt?: string };

      await sleep(400);

      // Call 2: content (raw HTML with template structure)
      const contentMsg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: buildContentSystemPrompt(templateKey),
        messages: [{ role: 'user', content: context }],
      });
      const rawContent = contentMsg.content[0].type === 'text' ? contentMsg.content[0].text : '';
      let content = cleanContent(extractHtmlContent(rawContent));

      // Fix structural anomalies
      content = content
        .replace(/<h1[^>]*>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>')
        .replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<\/?body[^>]*>/gi, '')
        .trim();

      if (!content.includes('<p>') || content.length < 500) {
        console.error(`  Content too short or malformed, skipping`);
        failed++;
        continue;
      }

      // Resolve image markers
      content = resolveImageMarkers(content, UNSPLASH_POOL, usedInlineIds);

      const updated = {
        ...post,
        title: cleanContent((meta.title || post.title).trim()),
        excerpt: cleanContent((meta.excerpt || post.excerpt).trim()),
        content,
      };

      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      console.log(`  Done. Content length: ${content.length} chars`);
      success++;
    } catch (err) {
      console.error(`  Failed: ${err}`);
      failed++;
    }

    if (i < REWRITES.length - 1) await sleep(800);
  }

  console.log(`\nCompleted: ${success} rewritten, ${failed} failed`);
  console.log('Run: npm run build && git add data/blog/ && git commit -m "rewrite: 14 blog posts with varied templates and inline images" && git push');
}

main().catch(console.error).finally(() => process.exit(0));
