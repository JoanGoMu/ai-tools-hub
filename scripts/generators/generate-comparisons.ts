/**
 * Auto-generates comparison entries for all active tools in the same category.
 * Writes to data/comparisons.json.
 * Never overwrites manually-written comparison entries.
 */
import fs from 'fs';
import path from 'path';
import type { Tool, Comparison } from '../../src/lib/types';

const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');
const COMPARISONS_FILE = path.join(process.cwd(), 'data', 'comparisons.json');

function loadAllTools(): Tool[] {
  return fs
    .readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, f), 'utf-8')) as Tool)
    .filter((t) => t.status === 'active');
}

function loadComparisons(): Comparison[] {
  if (!fs.existsSync(COMPARISONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(COMPARISONS_FILE, 'utf-8')) as Comparison[];
}

function main() {
  const tools = loadAllTools();
  const existing = loadComparisons();
  const existingSlugs = new Set(existing.map((c) => c.slug));

  const newComparisons: Comparison[] = [];

  // Group tools by category
  const byCategory = new Map<string, Tool[]>();
  for (const tool of tools) {
    for (const cat of tool.category) {
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(tool);
    }
  }

  // For each category, create pairwise comparisons for all active tools
  for (const catTools of Array.from(byCategory.values())) {
    for (let i = 0; i < catTools.length; i++) {
      for (let j = i + 1; j < catTools.length; j++) {
        // Enforce alphabetical slug order per site convention
        const [a, b] = catTools[i].slug < catTools[j].slug
          ? [catTools[i], catTools[j]]
          : [catTools[j], catTools[i]];
        const slug = `${a.slug}-vs-${b.slug}`;
        if (!existingSlugs.has(slug)) {
          newComparisons.push({
            slug,
            toolA: a.slug,
            toolB: b.slug,
            title: `${a.name} vs ${b.name}: Which AI Tool is Better?`,
          });
          existingSlugs.add(slug);
        }
      }
    }
  }

  if (newComparisons.length === 0) {
    console.log('No new comparison pages to generate.');
    return;
  }

  const updated = [...existing, ...newComparisons];
  fs.writeFileSync(COMPARISONS_FILE, JSON.stringify(updated, null, 2));
  console.log(`Generated ${newComparisons.length} new comparison page entries.`);
  newComparisons.forEach((c) => console.log(`  - ${c.slug}`));
}

main();
