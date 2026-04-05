import Link from 'next/link';
import { getFeaturedTools, getAllCategories, getAllComparisons, getFeaturedBlogPosts } from '@/lib/data';
import ToolCard from '@/components/tools/ToolCard';
import BlogCard from '@/components/blog/BlogCard';

export default function HomePage() {
  const featured = getFeaturedTools().slice(0, 6);
  const categories = getAllCategories();
  const comparisons = getAllComparisons().slice(0, 4);
  const blogPosts = getFeaturedBlogPosts().slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-50 to-white border-b border-gray-200 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            Find the Best AI Tools <br />
            <span className="text-indigo-600">for Your Workflow</span>
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Honest comparisons, pricing breakdowns, and side-by-side reviews of the top AI tools
            for writing, images, coding, video, and audio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              href="/tools"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Browse All Tools
            </Link>
            <Link
              href="/compare"
              className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-lg border border-gray-300 transition-colors"
            >
              Compare AI Tools →
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="bg-white border border-gray-200 rounded-xl p-5 text-center hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <div className="font-semibold text-sm text-gray-800">{cat.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Tools */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Featured AI Tools</h2>
          <Link href="/tools" className="text-sm text-indigo-600 font-medium hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      {/* Popular Comparisons */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Comparisons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {comparisons.map((comp) => (
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

      {/* Latest from the Blog */}
      {blogPosts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Latest from the Blog</h2>
            <Link href="/blog" className="text-sm text-indigo-600 font-medium hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Affiliate disclosure */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <p className="text-xs text-gray-400 text-center">
          Some links on this page are affiliate links. We may earn a commission at no extra cost to you.{' '}
          <Link href="/disclosure" className="underline hover:text-gray-600">Learn more</Link>.
        </p>
      </section>
    </div>
  );
}
