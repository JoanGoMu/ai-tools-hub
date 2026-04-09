'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tool, Category } from '@/lib/types';
import MultiComparisonTable from '@/components/comparison/MultiComparisonTable';
import ToolLogo from '@/components/ui/ToolLogo';

interface Props {
  tools: Tool[];
  categories: Category[];
}

export default function CustomComparePage({ tools, categories }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  const filtered = (selectedCategory === 'all'
    ? tools
    : tools.filter((t) => t.category.includes(selectedCategory))
  ).slice().sort((a, b) => a.name.localeCompare(b.name));

  function toggle(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectAll() {
    setSelectedSlugs(new Set(filtered.map((t) => t.slug)));
  }

  function clearAll() {
    setSelectedSlugs(new Set());
  }

  const selectedTools = tools.filter((t) => selectedSlugs.has(t.slug));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-indigo-600">Home</Link>
        <span>›</span>
        <Link href="/compare" className="hover:text-indigo-600">Compare</Link>
        <span>›</span>
        <span className="text-gray-800">Custom Comparison</span>
      </nav>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Build Your Own Comparison</h1>
      <p className="text-gray-500 mb-8">Pick any tools you want - the table updates as you select.</p>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setSelectedCategory(cat.slug)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.slug
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Tool picker */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-700">
            {selectedSlugs.size === 0
              ? 'Select at least 2 tools to compare'
              : `${selectedSlugs.size} tool${selectedSlugs.size === 1 ? '' : 's'} selected`}
          </p>
          <div className="flex gap-3">
            <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline">Select all</button>
            {selectedSlugs.size > 0 && (
              <button onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {filtered.map((tool) => {
            const selected = selectedSlugs.has(tool.slug);
            return (
              <button
                key={tool.slug}
                onClick={() => toggle(tool.slug)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                  selected
                    ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                }`}>
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <ToolLogo url={tool.url} name={tool.name} size={20} />
                <span className="text-sm font-medium text-gray-800 truncate">{tool.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison table */}
      {selectedTools.length >= 2 ? (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Comparing {selectedTools.map((t) => t.name).join(', ')}
          </h2>
          <MultiComparisonTable tools={selectedTools} />
        </section>
      ) : (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-lg font-medium">Select 2 or more tools above</p>
          <p className="text-sm mt-1">Your comparison table will appear here</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-10">
        This page contains affiliate links.{' '}
        <Link href="/disclosure" className="underline">Learn more</Link>.
      </p>
    </div>
  );
}
