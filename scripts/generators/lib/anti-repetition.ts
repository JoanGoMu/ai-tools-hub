/**
 * Anti-repetition system for blog post generation.
 * Tracks recently used H2 headings, opening sentences, and post structures
 * to prevent the generator from falling into the same patterns run after run.
 *
 * History is persisted in data/blog-generation-history.json which is
 * auto-committed by the existing GitHub Actions workflow (git add data/).
 */

import fs from 'fs';
import path from 'path';
import type { PostStructure } from './structure-generator.js';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'blog-generation-history.json');

const MAX_H2S = 100;     // keep last 100 h2 headings
const MAX_OPENINGS = 20; // keep last 20 opening sentences
const MAX_STRUCTURES = 10;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GenerationHistory {
  recentH2s: string[];
  recentOpenings: string[];
  recentStructures: PostStructure[];
  consecutiveZeroDays: number;
  lastPostDate: string | null;
}

interface StoredPost {
  slug: string;
  title: string;
  content: string;
}

// ── Load / save ────────────────────────────────────────────────────────────────

export function loadHistory(): GenerationHistory {
  if (!fs.existsSync(HISTORY_FILE)) {
    return {
      recentH2s: [],
      recentOpenings: [],
      recentStructures: [],
      consecutiveZeroDays: 0,
      lastPostDate: null,
    };
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as GenerationHistory;
  } catch {
    return {
      recentH2s: [],
      recentOpenings: [],
      recentStructures: [],
      consecutiveZeroDays: 0,
      lastPostDate: null,
    };
  }
}

function saveHistory(history: GenerationHistory): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ── Extraction helpers ─────────────────────────────────────────────────────────

function extractH2Texts(html: string): string[] {
  const texts: string[] = [];
  const regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text) texts.push(text);
  }
  return texts;
}

function extractFirstSentence(html: string): string {
  const m = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (!m) return '';
  const text = m[1].replace(/<[^>]+>/g, '').trim();
  const sentEnd = text.search(/[.!?]/);
  return sentEnd > 0 ? text.slice(0, sentEnd + 1) : text.slice(0, 120);
}

// ── Save to history ────────────────────────────────────────────────────────────

export function saveToHistory(post: StoredPost, structure: PostStructure): void {
  const history = loadHistory();
  const h2s = extractH2Texts(post.content);
  const opening = extractFirstSentence(post.content);

  // Prepend new items, trim to max length
  history.recentH2s = [...h2s, ...history.recentH2s].slice(0, MAX_H2S);
  history.recentOpenings = [opening, ...history.recentOpenings].slice(0, MAX_OPENINGS);
  history.recentStructures = [structure, ...history.recentStructures].slice(0, MAX_STRUCTURES);
  history.lastPostDate = new Date().toISOString().split('T')[0];
  history.consecutiveZeroDays = 0;

  saveHistory(history);
}

export function recordZeroPostDay(): void {
  const history = loadHistory();
  history.consecutiveZeroDays = (history.consecutiveZeroDays ?? 0) + 1;
  saveHistory(history);
}

// ── Build avoidance prompt ─────────────────────────────────────────────────────

export function buildAvoidancePrompt(history: GenerationHistory): string {
  if (
    history.recentH2s.length === 0 &&
    history.recentOpenings.length === 0
  ) {
    return '';
  }

  const lines: string[] = ['RECENTLY USED - DO NOT REPEAT:'];

  if (history.recentH2s.length > 0) {
    lines.push('');
    lines.push('These H2 headings were used in recent posts. Do not reuse them or close variations:');
    history.recentH2s.slice(0, 30).forEach(h2 => lines.push(`  - ${h2}`));
  }

  if (history.recentOpenings.length > 0) {
    lines.push('');
    lines.push('These opening sentences were recently used. Your opening must be structurally different:');
    history.recentOpenings.slice(0, 10).forEach(o => lines.push(`  - "${o}"`));
  }

  return lines.join('\n');
}
