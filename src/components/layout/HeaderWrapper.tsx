import { getAllTools, getAllComparisons } from '@/lib/data';
import Header from './Header';

export default function HeaderWrapper() {
  const tools = getAllTools().map((t) => ({
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    url: t.url,
    category: t.category,
  }));

  const comparisons = getAllComparisons().map((c) => ({
    slug: c.slug,
    title: c.title ?? '',
    toolA: c.toolA,
    toolB: c.toolB,
  }));

  return <Header searchData={{ tools, comparisons }} />;
}
