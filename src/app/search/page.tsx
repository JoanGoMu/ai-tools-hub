import { Suspense } from 'react';
import { getAllTools, getAllComparisons } from '@/lib/data';
import SearchClient from './SearchClient';

export default function SearchPage() {
  const tools = getAllTools();
  const comparisons = getAllComparisons();
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12">Loading…</div>}>
      <SearchClient tools={tools} comparisons={comparisons} />
    </Suspense>
  );
}
