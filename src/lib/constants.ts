export const SITE_NAME = 'AI Tools Hub';
export const SITE_TAGLINE = 'Find and Compare the Best AI Tools';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aitoolshub.pages.dev';

export const NAV_LINKS = [
  { href: '/tools', label: 'All Tools' },
  { href: '/category/ai-writing', label: 'Writing' },
  { href: '/category/ai-image', label: 'Image' },
  { href: '/category/ai-code', label: 'Coding' },
  { href: '/category/ai-video', label: 'Video' },
  { href: '/category/ai-audio', label: 'Audio' },
  { href: '/deals', label: '🔥 Deals' },
];

export const RATING_LABELS: Record<number, string> = {
  5: 'Outstanding',
  4: 'Great',
  3: 'Good',
  2: 'Fair',
  1: 'Poor',
};
