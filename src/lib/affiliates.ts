import fs from 'fs';
import path from 'path';

interface AffiliateEntry {
  url: string;
  network: string;
  commissionType: string;
  commissionRate: string;
  cookieDuration: string;
  status: 'active' | 'pending';
  notes?: string;
}

type AffiliateRegistry = Record<string, AffiliateEntry>;

function getRegistry(): AffiliateRegistry {
  const filePath = path.join(process.cwd(), 'data', 'affiliate-links.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AffiliateRegistry;
}

export function getAffiliateUrl(toolSlug: string, toolUrl: string): string {
  const registry = getRegistry();
  const entry = registry[toolSlug];
  if (entry && entry.status === 'active' && entry.url) {
    return entry.url;
  }
  return toolUrl;
}

export function hasActiveAffiliate(toolSlug: string): boolean {
  const registry = getRegistry();
  const entry = registry[toolSlug];
  return !!(entry && entry.status === 'active');
}
