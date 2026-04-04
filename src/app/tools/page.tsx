import { Metadata } from 'next';
import { getAllTools, getAllCategories } from '@/lib/data';
import ToolCard from '@/components/tools/ToolCard';

export const metadata: Metadata = {
  title: 'All AI Tools - Compare the Best AI Software',
  description: 'Browse and compare all AI tools across writing, image generation, coding, video, and audio categories. Pricing, features, and honest reviews.',
};

export default function AllToolsPage() {
  const tools = getAllTools();
  const categories = getAllCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">All AI Tools</h1>
      <p className="text-gray-500 mb-8">{tools.length} tools reviewed and compared</p>

      {categories.map((cat) => {
        const catTools = tools.filter((t) => t.category.includes(cat.slug));
        if (catTools.length === 0) return null;
        return (
          <section key={cat.slug} className="mb-14">
            <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
              {cat.icon} {cat.name}
            </h2>
            <p className="text-sm text-gray-500 mb-5">{cat.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {catTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
