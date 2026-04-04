'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Tool, Category, Comparison } from '@/lib/types';

interface Props {
  tools: Tool[];
  categories: Category[];
  comparisons: Comparison[];
}

export default function CompareSelector({ tools, categories, comparisons }: Props) {
  const [categorySlug, setCategorySlug] = useState('');
  const [toolASlug, setToolASlug] = useState('');
  const [toolBSlug, setToolBSlug] = useState('');

  const filteredTools = useMemo(() => {
    if (!categorySlug) return tools;
    return tools.filter((t) => t.category.includes(categorySlug));
  }, [tools, categorySlug]);

  const toolBOptions = useMemo(
    () => filteredTools.filter((t) => t.slug !== toolASlug),
    [filteredTools, toolASlug]
  );

  const comparisonSlug = useMemo(() => {
    if (!toolASlug || !toolBSlug) return null;
    const forward = `${toolASlug}-vs-${toolBSlug}`;
    const reverse = `${toolBSlug}-vs-${toolASlug}`;
    const match = comparisons.find((c) => c.slug === forward || c.slug === reverse);
    return match ? match.slug : null;
  }, [toolASlug, toolBSlug, comparisons]);

  const toolA = tools.find((t) => t.slug === toolASlug);
  const toolB = tools.find((t) => t.slug === toolBSlug);
  const bothSelected = !!toolASlug && !!toolBSlug;

  function handleCategoryChange(slug: string) {
    setCategorySlug(slug);
    setToolASlug('');
    setToolBSlug('');
  }

  function handleToolAChange(slug: string) {
    setToolASlug(slug);
    if (slug === toolBSlug) setToolBSlug('');
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Category
          </label>
          <select
            value={categorySlug}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tool A */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            First tool
          </label>
          <select
            value={toolASlug}
            onChange={(e) => handleToolAChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select a tool…</option>
            {filteredTools.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Tool B */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Second tool
          </label>
          <select
            value={toolBSlug}
            onChange={(e) => setToolBSlug(e.target.value)}
            disabled={!toolASlug}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select a tool…</option>
            {toolBOptions.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result */}
      {bothSelected && (
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 border-t border-gray-100 pt-6">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-gray-700 font-medium">
              {toolA?.name} <span className="text-gray-400">vs</span> {toolB?.name}
            </p>
            {!comparisonSlug && (
              <p className="text-sm text-gray-500 mt-1">
                No detailed comparison yet.{' '}
                <Link href={`/tools/${toolASlug}`} className="text-indigo-600 hover:underline">{toolA?.name}</Link>
                {' & '}
                <Link href={`/tools/${toolBSlug}`} className="text-indigo-600 hover:underline">{toolB?.name}</Link>
                {' individual pages are available.'}
              </p>
            )}
          </div>
          {comparisonSlug ? (
            <Link
              href={`/compare/${comparisonSlug}`}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Compare →
            </Link>
          ) : (
            <span className="text-sm text-gray-400 italic">Coming soon</span>
          )}
        </div>
      )}
    </div>
  );
}
