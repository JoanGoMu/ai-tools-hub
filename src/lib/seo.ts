import { Metadata } from 'next';
import { Tool, Category, Comparison, BlogPost } from './types';

const SITE_NAME = 'AI Tools Hub';
const SITE_URL = 'https://aitoolcrunch.com';
const SITE_DESCRIPTION =
  'Compare the best AI tools for writing, image generation, coding, video, and audio. Find deals, honest reviews, and side-by-side comparisons.';

export function siteMetadata(): Metadata {
  return {
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    metadataBase: new URL(SITE_URL),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    verification: { google: 'L-4aAWnfzmnlvksU4a2jhq72rZgN1ygeEh0140CNXps' },
    other: { 'impact-site-verification': '362b7191-0fb7-4ca8-9b40-010b3eed4fd0' },
  };
}

export function toolMetadata(tool: Tool): Metadata {
  const title = `${tool.name} Review 2026 - Pricing, Features & Alternatives`;
  const description = `${tool.tagline}. Read our in-depth ${tool.name} review: pricing plans (starting at ${tool.pricing.startingPrice ?? 'free'}), features, pros and cons, and how it compares to alternatives.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export function categoryMetadata(category: Category, toolCount: number): Metadata {
  const title = `Best ${category.name} Tools 2026 - Top ${toolCount} Compared`;
  const description = `Compare the top ${toolCount} ${category.name} tools. ${category.description} Find the best fit for your needs and budget.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export function comparisonMetadata(comparison: Comparison): Metadata {
  const title = comparison.title ?? `${comparison.toolA} vs ${comparison.toolB}: Which is Better?`;
  const description = comparison.verdict ?? `An in-depth comparison of ${comparison.toolA} vs ${comparison.toolB}. Pricing, features, pros, cons and a final verdict.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export function blogPostMetadata(post: BlogPost): Metadata {
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: 'article' },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt },
  };
}

export function getSiteUrl(): string {
  return SITE_URL;
}
