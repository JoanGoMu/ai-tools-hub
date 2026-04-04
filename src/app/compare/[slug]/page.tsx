import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllComparisons, getComparisonBySlug, getToolBySlug } from '@/lib/data';
import { comparisonMetadata } from '@/lib/seo';
import ComparisonTable from '@/components/comparison/ComparisonTable';
import AffiliateCTA from '@/components/tools/AffiliateCTA';
import ProsCons from '@/components/tools/ProsCons';
import JsonLd from '@/components/seo/JsonLd';
import ToolLogo from '@/components/ui/ToolLogo';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllComparisons().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const comparison = getComparisonBySlug(params.slug);
  if (!comparison) return {};
  return comparisonMetadata(comparison);
}

export default function ComparisonPage({ params }: Props) {
  const comparison = getComparisonBySlug(params.slug);
  if (!comparison) notFound();

  const toolA = getToolBySlug(comparison.toolA);
  const toolB = getToolBySlug(comparison.toolB);
  if (!toolA || !toolB) notFound();

  const winner = comparison.winner ? (comparison.winner === toolA.slug ? toolA : toolB) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: comparison.title,
    description: comparison.verdict,
    itemListElement: [toolA, toolB].map((tool, i) => ({
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-indigo-600">Home</Link>
          <span>›</span>
          <Link href="/tools" className="hover:text-indigo-600">Tools</Link>
          <span>›</span>
          <span className="text-gray-800">{toolA.name} vs {toolB.name}</span>
        </nav>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{comparison.title}</h1>
        <p className="text-gray-500 mb-8">
          Last updated: {new Date().getFullYear()}
        </p>

        {/* Quick CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          {[toolA, toolB].map((tool) => (
            <div key={tool.slug} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <ToolLogo url={tool.url} name={tool.name} size={28} />
                <h2 className="font-bold text-lg text-gray-900">{tool.name}</h2>
              </div>
              <p className="hidden sm:block text-sm text-gray-500 mt-1">{tool.tagline}</p>
              <div className="mt-4">
                <AffiliateCTA tool={tool} size="sm" />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {tool.pricing.hasFree ? 'Free plan available' : `From ${tool.pricing.startingPrice}`}
              </p>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Side-by-Side Comparison</h2>
          <ComparisonTable toolA={toolA} toolB={toolB} winner={comparison.winner} />
        </section>

        {/* Verdict */}
        {comparison.verdict && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Our Verdict</h2>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
              {winner && (
                <p className="text-sm font-semibold text-indigo-600 mb-2">
                  🏆 Winner: {winner.name}
                </p>
              )}
              <p className="text-gray-700 leading-relaxed">{comparison.verdict}</p>
            </div>
          </section>
        )}

        {/* Individual Pros & Cons */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{toolA.name} Pros & Cons</h2>
          <ProsCons pros={toolA.pros} cons={toolA.cons} />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{toolB.name} Pros & Cons</h2>
          <ProsCons pros={toolB.pros} cons={toolB.cons} />
        </section>

        {/* Bottom CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
          {[toolA, toolB].map((tool) => (
            <div key={tool.slug} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <ToolLogo url={tool.url} name={tool.name} size={24} />
                <p className="font-semibold text-gray-800">Try {tool.name}</p>
              </div>
              <AffiliateCTA tool={tool} size="md" />
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          This page contains affiliate links.{' '}
          <Link href="/disclosure" className="underline">Learn more</Link>.
        </p>
      </div>
    </>
  );
}
