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
