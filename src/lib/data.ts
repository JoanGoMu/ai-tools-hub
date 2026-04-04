import fs from 'fs';
import path from 'path';
import { Tool, Category, Comparison, Deal } from './types';

const dataDir = path.join(process.cwd(), 'data');

function getAffiliateRegistry(): Record<string, { url: string; status: string }> {
  const filePath = path.join(dataDir, 'affiliate-links.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function applyAffiliateUrl(tool: Tool): Tool {
  const registry = getAffiliateRegistry();
  const entry = registry[tool.slug];
  if (entry && entry.status === 'active' && entry.url) {
    return { ...tool, affiliateUrl: entry.url };
  }
  return tool;
}

export function getAllTools(): Tool[] {
  const toolsDir = path.join(dataDir, 'tools');
  const files = fs.readdirSync(toolsDir).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(toolsDir, f), 'utf-8')) as Tool)
    .filter((t) => t.status === 'active')
    .map(applyAffiliateUrl)
    .sort((a, b) => b.rating - a.rating);
}

export function getToolBySlug(slug: string): Tool | null {
  const filePath = path.join(dataDir, 'tools', `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const tool = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Tool;
  return tool.status === 'active' ? applyAffiliateUrl(tool) : null;
}

export function getToolsByCategory(categorySlug: string): Tool[] {
  return getAllTools().filter((t) => t.category.includes(categorySlug));
}

export function getFeaturedTools(): Tool[] {
  return getAllTools().filter((t) => t.featured);
}

export function getAllCategories(): Category[] {
  const filePath = path.join(dataDir, 'categories.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  return getAllCategories().find((c) => c.slug === slug) ?? null;
}

export function getAllComparisons(): Comparison[] {
  const filePath = path.join(dataDir, 'comparisons.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Comparison[];
}

export function getComparisonBySlug(slug: string): Comparison | null {
  return getAllComparisons().find((c) => c.slug === slug) ?? null;
}

export function getComparisonsForTool(toolSlug: string): Comparison[] {
  return getAllComparisons().filter(
    (c) => c.toolA === toolSlug || c.toolB === toolSlug
  );
}

export function getActiveDeals(): Deal[] {
  const filePath = path.join(dataDir, 'deals.json');
  const deals = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Deal[];
  return deals.filter((d) => d.status === 'active');
}

export function getRelatedTools(tool: Tool, limit = 4): Tool[] {
  return getAllTools()
    .filter((t) => t.slug !== tool.slug && t.category.some((c) => tool.category.includes(c)))
    .slice(0, limit);
}
