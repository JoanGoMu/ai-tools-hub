export interface AffiliateProgram {
  network: string;
  commissionType: 'recurring' | 'one-time';
  commissionRate: string;
  cookieDuration: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  billingCycle?: string;
  features: string[];
}

export interface Pricing {
  hasFree: boolean;
  startingPrice: string | null;
  plans: PricingPlan[];
}

export interface Tool {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string[];
  url: string;
  affiliateUrl: string | null;
  affiliateProgram: AffiliateProgram | null;
  pricing: Pricing;
  features: string[];
  pros: string[];
  cons: string[];
  rating: number;
  logoUrl: string;
  screenshotUrl: string | null;
  lastUpdated: string;
  source: 'manual' | 'scraped' | 'enriched';
  status: 'active' | 'draft' | 'archived';
  featured?: boolean;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export interface Comparison {
  slug: string;
  toolA: string;
  toolB: string;
  title?: string;
  verdict?: string;
  winner?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  publishedAt: string;
  tags: string[];
  status: 'published' | 'draft';
  featured?: boolean;
}

export interface Deal {
  id: string;
  toolSlug: string;
  title: string;
  description: string;
  discountCode?: string;
  discountPercent?: number;
  affiliateUrl: string;
  expiresAt: string | null;
  status: 'active' | 'expired';
}
