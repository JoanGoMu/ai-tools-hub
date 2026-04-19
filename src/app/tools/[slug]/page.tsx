import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllTools, getToolBySlug, getRelatedTools, getComparisonsForTool } from '@/lib/data';
import { toolMetadata } from '@/lib/seo';
import AffiliateCTA from '@/components/tools/AffiliateCTA';
import PricingTable from '@/components/tools/PricingTable';
import ProsCons from '@/components/tools/ProsCons';
import ToolCard from '@/components/tools/ToolCard';
import StarRating from '@/components/ui/StarRating';
import JsonLd from '@/components/seo/JsonLd';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getToolBySlug(params.slug);
  if (!tool) return {};
  return toolMetadata(tool);
}

export default function ToolPage({ params }: Props) {
  const tool = getToolBySlug(params.slug);
  if (!tool) notFound();

  const related = getRelatedTools(tool);
  const comparisons = getComparisonsForTool(tool.slug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description: tool.description,
    url: tool.url,
    applicationCategory: 'AIApplication',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: tool.rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: 1,
    },
    offers: tool.pricing.plans.map((p) => ({
      '@type': 'Offer',
      name: p.name,
      price: p.price === '$0' ? '0' : p.price.replace(/[^0-9.]/g, '') || p.price,
      priceCurrency: 'USD',
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-indigo-600">Home</Link>
          <span>›</span>
          <Link href="/tools" className="hover:text-indigo-600">Tools</Link>
          <span>›</span>
          <span className="text-gray-800">{tool.name}</span>
        </nav>

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">{tool.name}</h1>
              <p className="text-lg text-gray-500 mt-1">{tool.tagline}</p>
              <div className="flex items-center gap-3 mt-3">
                <StarRating rating={tool.rating} />
                <span className="text-gray-600 font-medium">{tool.rating.toFixed(1)} / 5</span>
                {tool.pricing.hasFree && (
                  <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Free plan available
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <AffiliateCTA tool={tool} size="lg" />
              <p className="text-xs text-gray-400">
                {tool.pricing.hasFree ? 'Start free, upgrade anytime' : `From ${tool.pricing.startingPrice}`}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">What is {tool.name}?</h2>
          <div className="space-y-4">
            {tool.description.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-gray-600 leading-relaxed">{para.trim()}</p>
            ))}
          </div>
          {(tool.bestFor || tool.keyStrength) && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tool.bestFor && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Best for</p>
                  <p className="text-sm text-gray-700">{tool.bestFor}</p>
                </div>
              )}
              {tool.keyStrength && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Key strength</p>
                  <p className="text-sm text-gray-700">{tool.keyStrength}</p>
                </div>
              )}
            </div>
          )}
          {tool.scores && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Ease of use', value: tool.scores.easeOfUse },
                { label: 'Learning curve', value: tool.scores.learningCurve },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${(value / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{value.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pros & Cons */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pros & Cons</h2>
          <ProsCons pros={tool.pros} cons={tool.cons} />
        </section>

        {/* Features */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Key Features</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tool.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-indigo-500">✓</span> {f}
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing */}
        <section className="mb-10">
          <PricingTable tool={tool} />
        </section>

        {/* Comparisons */}
        {comparisons.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{tool.name} vs Competitors</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {comparisons.map((comp) => (
                <Link
                  key={comp.slug}
                  href={`/compare/${comp.slug}`}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-indigo-700"
                >
                  {comp.title} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Tools */}
        {related.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Related Tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {related.map((t) => (
                <ToolCard key={t.slug} tool={t} />
              ))}
            </div>
          </section>
        )}

        {/* Affiliate disclosure */}
        <p className="mt-10 text-xs text-gray-400">
          This page contains affiliate links. We may earn a commission at no extra cost to you.{' '}
          <Link href="/disclosure" className="underline">Learn more</Link>.
        </p>
      </div>
    </>
  );
}
