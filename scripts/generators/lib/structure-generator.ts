/**
 * Composable post structure generator.
 * Replaces the 6 fixed rotating templates with randomly assembled structures
 * that vary the opening approach, section types, section count, optional HTML
 * elements, and closing strategy. Each call produces a unique PostStructure.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PostStructure {
  opening: string;
  sections: string[];
  closing: string;
  suggestedElements: string[];  // HTML elements to consider using (not mandatory)
}

// ── Opening strategies ─────────────────────────────────────────────────────────

const OPENING_STRATEGIES: string[] = [
  'Open with a specific number, measurement, or benchmark that is surprising or counterintuitive. The number must be real and verifiable from the source. Do not fabricate statistics.',
  'Open with a direct question aimed at a specific reader (a developer, a content team, a solo founder). The question should make them think "yes, that is exactly my problem."',
  'Open with a short concrete scenario (2-3 sentences): describe a specific person doing a specific task, then show how it connects to the topic. No named fictional characters.',
  'Open with a bold, specific claim that a reader in this space would find mildly surprising but defensible. State it plainly in one sentence, then spend the intro earning it.',
  'Open with a timeline contrast: what was true 12-18 months ago versus what is true today. Keep it factual and tied to the actual news item.',
  'Open mid-scene: describe what it feels like to use the tool or experience the thing the post is about. Concrete sensory or workflow details. No purple prose.',
  'Open with the single sentence that best summarizes the entire post - the real point, plainly stated. Then spend the rest of the article proving it.',
  'Open by naming the exact decision the reader is currently trying to make. Frame it as a fork: "You are choosing between X and Y because Z." Then promise to resolve it.',
  'Open with a failure: something went wrong, a tool broke, a workflow collapsed, an assumption proved false. Start with the problem, not the solution.',
  'Open with the most surprising detail buried in the source material - not the headline, but the one specific fact or number that changes how you understand the headline.',
  'Open with a direct quote from the announcement, Reddit thread, or source article - something short enough to be striking. Then immediately state what is significant about it.',
  'Open with the specific thing that changed this week and why it matters to someone doing concrete work with AI tools. No context-setting preamble.',
];

// ── Section types ──────────────────────────────────────────────────────────────

const SECTION_TYPES: string[] = [
  'analysis: explain what is actually happening beneath the surface of the news/topic. What is the mechanism? What caused it?',
  'practical-example: give a specific use case, workflow, or scenario where this plays out. Real enough to be recognizable, concrete enough to be useful.',
  'counterargument: steelman the opposing view. What would a skeptic say? Why might this not matter? Engage seriously with the best version of the objection.',
  'historical-context: what earlier moment or pattern does this resemble? What does history say about how this kind of shift tends to play out?',
  'cost-breakdown: what does this actually cost? Not just the pricing page - what does it cost in time, setup, maintenance, switching, or opportunity? Be specific.',
  'user-scenarios: who specifically should use this? Not demographics - specific workflow moments. "If you are doing X, this helps. If you are doing Y, skip it."',
  'technical-deep-dive: explain the technical mechanism in plain language. What actually happens under the hood? Include a code snippet or CLI command if relevant.',
  'prediction: make a specific, falsifiable prediction about how this develops over the next 3-6 months. Commit to a stance.',
  'comparison-matrix: compare the options directly. Use a table if you have 3+ things to compare. Be decisive about which wins for which use case.',
  'step-by-step: walk through the exact process. Numbered steps, real commands or settings, a verification checklist at the end.',
  'common-mistakes: what do people get wrong when they try to use this tool or approach? What are the failure modes? What did you expect to work that does not?',
  'pricing-reality: dig into what users actually pay vs what the pricing page says. Hidden costs, tier limits, overage fees, what the free tier actually gives you.',
];

// ── Closing strategies ─────────────────────────────────────────────────────────

const CLOSING_STRATEGIES: string[] = [
  'End with a specific, falsifiable prediction: something that will be proven right or wrong within 6 months. Name the outcome and the timeframe.',
  'End with a direct challenge or action: one specific thing the reader should do this week, with enough detail to actually do it.',
  'End with a recommendation table: rows are user types or use cases, columns are options and why each wins. Make it scannable and decisive.',
  'End with a verification checklist: a short unordered list of things to confirm after taking the action described in the post.',
  'End with a TL;DR box: <div class="blog-tldr"><p>TL;DR</p><p>Two-sentence plain-English summary of the key takeaway and what to do about it.</p></div>',
  'End with an open question: one genuinely unresolved question that follows from everything the post established. Not rhetorical - a real question worth watching.',
  'End with a concrete next step and a rough timeline: "If this is relevant to you, the earliest you could act on this productively is [specific timeframe] because [specific reason]."',
  'End by calling back to the opening: return to the scenario, number, or claim from the first paragraph and show what it looks like now that the reader has the full picture.',
];

// ── Optional HTML element combinations ────────────────────────────────────────
// Suggested (not required) elements to enrich the post. The model picks from
// these based on what actually serves the content.

const ELEMENT_COMBOS: string[][] = [
  ['comparison table (thead/tbody)', 'blockquote'],
  ['numbered list (ol)', 'code block (pre/code)'],
  ['h3 sub-headings', 'aside.blog-pullquote'],
  ['unordered list (ul)', 'comparison table'],
  ['div.blog-stat', 'blockquote'],
  ['div.blog-callout', 'code block'],
  ['div.blog-tldr', 'numbered list'],
  ['h3 sub-headings', 'div.blog-stat'],
  ['aside.blog-pullquote', 'unordered list'],
  ['div.blog-callout', 'comparison table'],
];

// ── Compatibility rules ────────────────────────────────────────────────────────
// Section pairs that do not work well together are excluded.

const INCOMPATIBLE_PAIRS: [string, string][] = [
  ['step-by-step', 'historical-context'],     // procedural + historical is jarring
  ['comparison-matrix', 'user-scenarios'],    // both are "who should use this" answers
  ['prediction', 'historical-context'],       // both handle time; pick one
];

function areSectionsCompatible(selected: string[]): boolean {
  const types = selected.map(s => s.split(':')[0]);
  for (const [a, b] of INCOMPATIBLE_PAIRS) {
    if (types.includes(a) && types.includes(b)) return false;
  }
  return true;
}

// ── Structure generator ────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number, exclude?: T[]): T[] {
  const pool = exclude ? arr.filter(x => !exclude.includes(x)) : [...arr];
  const result: T[] = [];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

export function generateStructure(recentStructures: PostStructure[]): PostStructure {
  const recentOpenings = recentStructures.map(s => s.opening);
  const recentClosings = recentStructures.map(s => s.closing);

  // Pick opening - avoid the last 4 used
  const recentOpeningTexts = recentOpenings.slice(0, 4);
  const availableOpenings = OPENING_STRATEGIES.filter(o => !recentOpeningTexts.includes(o));
  const opening = pickRandom(availableOpenings.length > 0 ? availableOpenings : OPENING_STRATEGIES);

  // Pick closing - avoid the last 3 used
  const recentClosingTexts = recentClosings.slice(0, 3);
  const availableClosings = CLOSING_STRATEGIES.filter(c => !recentClosingTexts.includes(c));
  const closing = pickRandom(availableClosings.length > 0 ? availableClosings : CLOSING_STRATEGIES);

  // Pick 3-5 sections with compatibility check
  const sectionCount = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5

  // Avoid section types used in last 2 posts
  const recentSectionTypes = new Set(
    recentStructures.slice(0, 2).flatMap(s => s.sections.map(sec => sec.split(':')[0]))
  );
  const preferredPool = SECTION_TYPES.filter(s => !recentSectionTypes.has(s.split(':')[0]));
  const pool = preferredPool.length >= sectionCount ? preferredPool : SECTION_TYPES;

  let sections: string[] = [];
  let attempts = 0;
  while (attempts < 20) {
    sections = pickRandomN(pool, sectionCount);
    if (areSectionsCompatible(sections)) break;
    attempts++;
  }
  if (sections.length === 0) sections = pickRandomN(SECTION_TYPES, sectionCount);

  // Pick element combo
  const suggestedElements = pickRandom(ELEMENT_COMBOS);

  return { opening, sections, closing, suggestedElements };
}

/** Serializes a PostStructure into the prompt block that replaces the old TEMPLATE_BLOCK. */
export function structureToPromptBlock(structure: PostStructure): string {
  const sectionLines = structure.sections.map((s, i) => `  Section ${i + 1}: ${s}`).join('\n');
  return `
STRUCTURE FOR THIS POST:

Opening approach: ${structure.opening}
Your first paragraph MUST follow this approach. No exceptions.

Body sections (write in this order - use your own h2 heading for each):
${sectionLines}

Closing approach: ${structure.closing}
Your final section MUST use this closing approach.

Optional HTML elements (use only if they genuinely serve this specific content - not as decoration):
${structure.suggestedElements.map(e => `  - ${e}`).join('\n')}

Return ONLY the raw HTML string. No JSON wrapper, no markdown fences, no explanation before or after.`;
}
