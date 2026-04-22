/**
 * Multi-pass quality rewrite for blog post generation.
 * When banned patterns are detected in generated content, this runs a
 * targeted Sonnet rewrite to fix only the offending sections.
 * Only invoked when hasBannedContent() returns true, keeping costs low.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ScanResult } from './banned-patterns.js';

const MAX_REWRITE_ATTEMPTS = 2;

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

function buildRewritePrompt(violations: ScanResult): string {
  const parts: string[] = [
    'The HTML blog post below contains specific quality problems. Fix ONLY the sections containing these problems. Keep everything else exactly as-is.',
    '',
    'PROBLEMS TO FIX:',
  ];

  if (violations.phrases.length > 0) {
    parts.push(`- Banned phrases found (remove or rephrase all occurrences): ${violations.phrases.join(', ')}`);
  }
  if (violations.h2s.length > 0) {
    parts.push('- H2 headings that must be rewritten (they are too generic or AI-sounding):');
    violations.h2s.forEach(h2 => parts.push(`  "${h2}"`));
    parts.push('  Replace each with a specific, concrete heading that describes what that section actually covers.');
  }
  if (violations.opening.length > 0) {
    parts.push('- Opening paragraph follows a banned pattern (debunking opener or news announcement). Rewrite just the first paragraph with a more direct, specific opening.');
  }

  parts.push('');
  parts.push('RULES FOR THE REWRITE:');
  parts.push('- Do not add any new sections or remove existing ones');
  parts.push('- Do not change any content that does not contain the listed problems');
  parts.push('- Do not use em dashes (U+2014) or en dashes (U+2013)');
  parts.push('- Do not add "genuinely", "seamless", "robust", "game-changer", "cutting-edge", "paradigm", "holistic", "synergy", "empower", "leverage", "utilize", "deep dive", "delve"');
  parts.push('- Return ONLY the complete corrected HTML. No explanation, no markdown fences.');

  return parts.join('\n');
}

export async function critiqueAndRewrite(
  client: Anthropic,
  content: string,
  violations: ScanResult,
): Promise<string> {
  let current = content;

  for (let attempt = 1; attempt <= MAX_REWRITE_ATTEMPTS; attempt++) {
    console.log(`  Quality rewrite attempt ${attempt}/${MAX_REWRITE_ATTEMPTS}...`);
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 7000,
        system: buildRewritePrompt(violations),
        messages: [{ role: 'user', content: current }],
      });
      const raw = response.content[0].type === 'text' ? response.content[0].text : '';
      if (raw.length > 200) {
        current = extractHtmlContent(raw);
        console.log(`  Rewrite attempt ${attempt} complete (${current.length} chars)`);
        break;
      }
    } catch (err) {
      console.error(`  Rewrite attempt ${attempt} failed: ${err}`);
    }
  }

  return current;
}
