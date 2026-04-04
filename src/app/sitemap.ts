import { MetadataRoute } from 'next';
import { getAllTools, getAllCategories, getAllComparisons } from '@/lib/data';
import { getSiteUrl } from '@/lib/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const tools = getAllTools();
  const categories = getAllCategories();
  const comparisons = getAllComparisons();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), priority: 1.0, changeFrequency: 'daily' },
    { url: `${base}/tools`, lastModified: new Date(), priority: 0.8, changeFrequency: 'daily' },
    { url: `${base}/deals`, lastModified: new Date(), priority: 0.7, changeFrequency: 'daily' },
    { url: `${base}/disclosure`, lastModified: new Date(), priority: 0.3, changeFrequency: 'yearly' },
  ];

  const toolPages: MetadataRoute.Sitemap = tools.map((t) => ({
    url: `${base}/tools/${t.slug}`,
    lastModified: new Date(t.lastUpdated),
    priority: 0.7,
    changeFrequency: 'weekly' as const,
  }));

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: new Date(),
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  }));

  const comparisonPages: MetadataRoute.Sitemap = comparisons.map((c) => ({
    url: `${base}/compare/${c.slug}`,
    lastModified: new Date(),
    priority: 0.9,
    changeFrequency: 'monthly' as const,
  }));

  return [...staticPages, ...toolPages, ...categoryPages, ...comparisonPages];
}
