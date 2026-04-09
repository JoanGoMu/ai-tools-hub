import { Metadata } from 'next';
import Link from 'next/link';
import { getAllTools, getAllCategories, getAllComparisons } from '@/lib/data';
import CompareSelector from '@/components/compare/CompareSelector';

export const metadata: Metadata = {
  title: 'Compare AI Tools Side by Side | AI Tools Hub',
  description: 'Pick any two AI tools and compare them side by side. See pricing, features, pros and cons, and our verdict.',
};

export default function ComparePage() {
  const tools = getAllTools();
  const categories = getAllCategories();
  const comparisons = getAllComparisons();

  // Group comparisons by category for the listing below
  const comparisonsByCategory = categories.map((cat) => ({
    category: cat,
    comparisons: comparisons.filter((comp) => {
      const toolA = tools.find((t) => t.slug === comp.toolA);
      const toolB = tools.find((t) => t.slug === comp.toolB);
      return toolA?.category.includes(cat.slug) || toolB?.category.includes(cat.slug);
    }),
  })).filter((g) => g.comparisons.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Compare AI Tools</h1>
      <p className="text-gray-500 mb-8">
        Select a category and two tools to see a full side-by-side comparison.
      </p>

      <CompareSelector tools={tools} categories={categories} comparisons={comparisons} />

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-400">or</p>
        <Link href="/compare/custom" className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:underline">
          Build your own comparison - pick any tools you want →
        </Link>
      </div>

      {/* Compare all tools in a category */}
      <div className="mt-12 mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Compare All Tools in a Category</h2>
        <p className="text-gray-500 text-sm mb-5">See every tool in a category side by side with ratings, pricing, ease of use and more.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/compare/category/${cat.slug}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex items-center gap-3"
            >
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                <p className="text-xs text-indigo-600 mt-0.5">Compare all →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* All comparisons grouped by category */}
      <div className="mt-16 space-y-12">
        {comparisonsByCategory.map(({ category, comparisons: catComps }) => (
          <section key={category.slug}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {category.icon} {category.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {catComps.map((comp) => (
                <Link
                  key={comp.slug}
                  href={`/compare/${comp.slug}`}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <h3 className="font-semibold text-gray-900">{comp.title}</h3>
                  {comp.verdict && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{comp.verdict}</p>
                  )}
                  <span className="mt-3 inline-block text-xs font-medium text-indigo-600">
                    See full comparison →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
