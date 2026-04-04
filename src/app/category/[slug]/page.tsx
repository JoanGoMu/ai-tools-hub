import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllCategories, getCategoryBySlug, getToolsByCategory } from '@/lib/data';
import { categoryMetadata } from '@/lib/seo';
import ToolCard from '@/components/tools/ToolCard';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategoryBySlug(params.slug);
  if (!category) return {};
  const tools = getToolsByCategory(params.slug);
  return categoryMetadata(category, tools.length);
}

export default function CategoryPage({ params }: Props) {
  const category = getCategoryBySlug(params.slug);
  if (!category) notFound();

  const tools = getToolsByCategory(params.slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-indigo-600">Home</Link>
        <span>›</span>
        <span className="text-gray-800">{category.name}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">
          {category.icon} Best {category.name} Tools
        </h1>
        <p className="mt-2 text-gray-500">{category.description}</p>
        <p className="mt-1 text-sm text-gray-400">{tools.length} tools reviewed</p>
      </div>

      {tools.length === 0 ? (
        <p className="text-gray-500">No tools in this category yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      )}

      <p className="mt-12 text-xs text-gray-400">
        Some links on this page are affiliate links.{' '}
        <Link href="/disclosure" className="underline">Learn more</Link>.
      </p>
    </div>
  );
}
