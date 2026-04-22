/**
 * Banned patterns registry for blog post generation.
 * Scans generated HTML for AI-signature phrases and structural patterns
 * that make posts sound formulaic or machine-written.
 */

// ── Banned inline phrases ──────────────────────────────────────────────────────
// Words and phrases that are AI writing tells. Checked against full post text.

export const BANNED_PHRASES: string[] = [
  'genuinely',
  'utilize',
  'utilise',
  'seamless',
  'seamlessly',
  'robust',
  'game-changer',
  'game changer',
  'groundbreaking',
  'cutting-edge',
  'cutting edge',
  'paradigm shift',
  'holistic',
  'synergy',
  'synergies',
  'empower',
  'empowers',
  'empowering',
  'empowered',
  'leverage' ,  // as verb - "leverage AI" not "lever"
  'at the end of the day',
  "it's worth noting",
  'it is worth noting',
  'needless to say',
  "let's dive in",
  'let us dive in',
  'in this article',
  'in this post',
  'the honest answer',
  'the honest truth',
  'the honest verdict',
  'deep dive',  // as noun - "a deep dive into"
  'delve',
  'delves',
  'delving',
  'elevate',
  'elevates',
  'elevating',
  'foster',
  'fosters',
  'fostering',
  'pave the way',
  'paves the way',
  'in conclusion',
  'to summarize',
  'to summarise',
  'in summary',
  'in a nutshell',
  'the bottom line is',
  'the bigger picture',
  'the broader picture',
  'the broader signal',
  'the broader shift',
  'the broader pattern',
  'what this means for',
  'most people',
  'most users',
  'most developers',
  'most teams',
];

// ── Banned H2 heading patterns ─────────────────────────────────────────────────
// Regexes tested against each H2 heading's text content.

export const BANNED_H2_PATTERNS: RegExp[] = [
  /what\s+\S+\s+actually/i,           // "What X actually does/is/means"
  /who\s+this\s+is\s+for/i,           // "Who this is for"
  /the\s+broad(er)?\s+(picture|signal|shift|pattern)/i,
  /what\s+this\s+means\s+for/i,
  /final\s+thoughts?$/i,
  /^conclusion$/i,
  /the\s+bottom\s+line/i,
  /wrapping\s+up/i,
  /^in\s+summary$/i,
  /the\s+honest\s+/i,                 // "The honest answer", "The honest verdict"
  /the\s+bigger\s+picture/i,
  /what\s+comes?\s+next/i,
  /moving\s+forward/i,
  /looking\s+ahead/i,
  /the\s+takeaway/i,
  /key\s+takeaways?/i,
];

// ── Banned opening patterns ────────────────────────────────────────────────────
// Regexes tested against the text of the very first paragraph.

export const BANNED_OPENING_PATTERNS: RegExp[] = [
  /^most\s+\S+\s+(articles?|posts?|guides?|roundups?|pieces?)\s+(are|is|were|have been)/i,
  /^a\s+lot\s+of\s+\S+\s+(articles?|posts?)\s+(are|is)/i,
  /\bjust\s+(announced|released|launched|dropped)\b/i,
  /\ba\s+(post|thread|article|discussion)\s+(appeared|landed|showed\s+up)\s+on\b/i,
  /\blanded\s+on\s+(hacker\s+news|hn|reddit)\b/i,
  /\bwent\s+viral\s+on\b/i,
];

// ── Scanner ────────────────────────────────────────────────────────────────────

export interface ScanResult {
  phrases: string[];
  h2s: string[];
  opening: string[];
}

function extractText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractH2Texts(html: string): string[] {
  const matches: string[] = [];
  const regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    matches.push(extractText(m[1]));
  }
  return matches;
}

function extractFirstParagraphText(html: string): string {
  const m = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  return m ? extractText(m[1]) : '';
}

export function scanForViolations(html: string): ScanResult {
  const fullText = extractText(html).toLowerCase();
  const h2Texts = extractH2Texts(html);
  const firstPara = extractFirstParagraphText(html).toLowerCase();

  const phrases: string[] = [];
  for (const phrase of BANNED_PHRASES) {
    if (fullText.includes(phrase.toLowerCase())) {
      phrases.push(phrase);
    }
  }

  const h2s: string[] = [];
  for (const h2 of h2Texts) {
    for (const pattern of BANNED_H2_PATTERNS) {
      if (pattern.test(h2)) {
        h2s.push(h2);
        break;
      }
    }
  }

  const opening: string[] = [];
  for (const pattern of BANNED_OPENING_PATTERNS) {
    if (pattern.test(firstPara)) {
      opening.push(firstPara.slice(0, 120));
      break;
    }
  }

  return { phrases, h2s, opening };
}

export function hasBannedContent(html: string): boolean {
  const result = scanForViolations(html);
  return result.phrases.length > 0 || result.h2s.length > 0 || result.opening.length > 0;
}

/** Returns a compact string for use in prompts: the full banned-phrases list. */
export function getBannedPhrasesForPrompt(): string {
  return BANNED_PHRASES.join(', ');
}
