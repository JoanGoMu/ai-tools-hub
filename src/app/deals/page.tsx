import { Metadata } from 'next';
import Link from 'next/link';
import { getActiveDeals, getToolBySlug } from '@/lib/data';

export const metadata: Metadata = {
  title: 'AI Tool Deals & Discounts - Best Offers This Month',
  description: 'Find the best discounts, promo codes, and deals on top AI tools. Updated regularly.',
};

export default function DealsPage() {
  const deals = getActiveDeals();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">🔥 AI Tool Deals</h1>
      <p className="text-gray-500 mb-10">Current discounts and promo codes for the best AI tools.</p>

      {deals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-500">
          <p className="text-4xl mb-4">🔍</p>
          <p className="font-semibold text-lg text-gray-700 mb-2">No active deals right now</p>
          <p className="text-sm">Check back soon — we update this page regularly as new deals drop.</p>
          <Link
            href="/tools"
            className="mt-6 inline-block text-sm text-indigo-600 font-medium hover:underline"
          >
            Browse all tools instead →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {deals.map((deal) => {
            const tool = getToolBySlug(deal.toolSlug);
            return (
              <div key={deal.id} className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {tool && (
                      <Link href={`/tools/${tool.slug}`} className="font-bold text-gray-900 hover:text-indigo-600">
                        {tool.name}
                      </Link>
                    )}
                    {deal.discountPercent && (
                      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {deal.discountPercent}% OFF
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{deal.description}</p>
                  {deal.discountCode && (
                    <code className="mt-2 inline-block text-xs bg-gray-100 text-gray-800 px-3 py-1 rounded font-mono">
                      {deal.discountCode}
                    </code>
                  )}
                  {deal.expiresAt && (
                    <p className="text-xs text-gray-400 mt-1">Expires: {deal.expiresAt}</p>
                  )}
                </div>
                <a
                  href={deal.affiliateUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Get Deal →
                </a>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-xs text-gray-400">
        Some links on this page are affiliate links.{' '}
        <Link href="/disclosure" className="underline">Learn more</Link>.
      </p>
    </div>
  );
}
