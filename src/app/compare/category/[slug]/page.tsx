import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllCategories, getToolsByCategory, getCategoryBySlug } from '@/lib/data';
import { categoryComparisonMetadata } from '@/lib/seo';
import MultiComparisonTable from '@/components/comparison/MultiComparisonTable';
import ProsCons from '@/components/tools/ProsCons';
import AffiliateCTA from '@/components/tools/AffiliateCTA';
import ToolLogo from '@/components/ui/ToolLogo';
import JsonLd from '@/components/seo/JsonLd';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllCategories()
    .filter((cat) => getToolsByCategory(cat.slug).length >= 2)
    .map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategoryBySlug(params.slug);
  if (!category) return {};
  const tools = getToolsByCategory(params.slug);
  return categoryComparisonMetadata(category, tools.length);
}

export default function CategoryComparisonPage({ params }: Props) {
  const category = getCategoryBySlug(params.slug);
  if (!category) notFound();

  const tools = getToolsByCategory(params.slug);
  if (tools.length < 2) notFound();

  const sorted = [...tools].sort((a, b) => b.rating - a.rating);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Best ${category.name} Tools Compared`,
    description: `Side-by-side comparison of all ${category.name} tools`,
    itemListElement: sorted.map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: tool.name,
        url: tool.url,
        description: tool.tagline,
      },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-indigo-600">Home</Link>
          <span>›</span>
          <Link href="/compare" className="hover:text-indigo-600">Compare</Link>
          <span>›</span>
          <span className="text-gray-800">{category.name} Tools</span>
        </nav>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
          {category.icon} Best {category.name} Tools Compared (2026)
        </h1>
        <p className="text-gray-500 mb-10 text-lg">
          {sorted.length} tools compared side by side - ratings, pricing, ease of use, key features, pros and cons.
        </p>

        {/* Main comparison table */}
        <section className="mb-14">
          <MultiComparisonTable tools={sorted} />
        </section>

        {/* Per-tool detail sections */}
        <section className="space-y-12">
          <h2 className="text-2xl font-bold text-gray-900">Full Tool Breakdown</h2>
          {sorted.map((tool, i) => (
            <div key={tool.slug} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-300">#{i + 1}</span>
                  <ToolLogo url={tool.url} name={tool.name} size={36} />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{tool.name}</h3>
                    <p className="text-sm text-gray-500">{tool.tagline}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-2xl font-bold text-gray-900">{tool.rating}/5</span>
                  <span className="text-xs text-gray-400">Our rating</span>
                </div>
              </div>

              {(tool.bestFor || tool.keyStrength) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {tool.bestFor && (
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Best For</p>
                      <p className="text-sm text-gray-700">{tool.bestFor}</p>
                    </div>
                  )}
                  {tool.keyStrength && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Key Strength</p>
                      <p className="text-sm text-gray-700">{tool.keyStrength}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <ProsCons pros={tool.pros} cons={tool.cons} />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {tool.pricing.hasFree ? 'Free plan available' : `From ${tool.pricing.startingPrice}`}
                  </span>
                  {tool.pricing.startingPrice && tool.pricing.hasFree && (
                    <span className="text-sm text-gray-400"> · paid from {tool.pricing.startingPrice}</span>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                  <Link href={`/tools/${tool.slug}`} className="text-sm text-indigo-600 hover:underline whitespace-nowrap">
                    Full review →
                  </Link>
                  <div className="w-40">
                    <AffiliateCTA tool={tool} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <p className="text-xs text-gray-400 mt-10">
          This page contains affiliate links.{' '}
          <Link href="/disclosure" className="underline">Learn more</Link>.
        </p>
      </div>
    </>
  );
}
