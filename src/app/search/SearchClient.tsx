'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tool, Comparison } from '@/lib/types';
import ToolCard from '@/components/tools/ToolCard';
import ToolLogo from '@/components/ui/ToolLogo';

interface Props {
  tools: Tool[];
  comparisons: Comparison[];
}

export default function SearchClient({ tools, comparisons }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    const url = val.trim() ? `/search?q=${encodeURIComponent(val.trim())}` : '/search';
    router.replace(url, { scroll: false });
  }

  const q = query.toLowerCase().trim();

  const matchedTools = useMemo(() => {
    if (!q) return [];
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [q, tools]);

  const matchedComparisons = useMemo(() => {
    if (!q) return [];
    return comparisons.filter((c) => c.title?.toLowerCase().includes(q));
  }, [q, comparisons]);

  const hasResults = matchedTools.length > 0 || matchedComparisons.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Search AI Tools</h1>

      <input
        type="text"
        autoFocus
        placeholder="Search tools, comparisons…"
        value={query}
        onChange={handleChange}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {q && (
        <div className="mt-8 space-y-10">
          {matchedTools.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Tools <span className="text-gray-400 font-normal text-sm">({matchedTools.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {matchedTools.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </section>
          )}

          {matchedComparisons.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Comparisons <span className="text-gray-400 font-normal text-sm">({matchedComparisons.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {matchedComparisons.map((comp) => {
                  const toolA = tools.find((t) => t.slug === comp.toolA);
                  const toolB = tools.find((t) => t.slug === comp.toolB);
                  return (
                    <Link
                      key={comp.slug}
                      href={`/compare/${comp.slug}`}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {toolA && <ToolLogo url={toolA.url} name={toolA.name} size={20} />}
                        {toolB && <ToolLogo url={toolB.url} name={toolB.name} size={20} />}
                      </div>
                      <h3 className="font-semibold text-gray-900">{comp.title}</h3>
                      {comp.verdict && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{comp.verdict}</p>
                      )}
                      <span className="mt-2 inline-block text-xs font-medium text-indigo-600">
                        See full comparison →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {!hasResults && (
            <p className="text-gray-500">
              No results for <strong>&ldquo;{query}&rdquo;</strong>. Try a different term or{' '}
              <Link href="/tools" className="text-indigo-600 hover:underline">browse all tools</Link>.
            </p>
          )}
        </div>
      )}

      {!q && (
        <p className="mt-6 text-gray-400 text-sm">
          Start typing to search across {tools.length} tools and {comparisons.length} comparisons.
        </p>
      )}
    </div>
  );
}
