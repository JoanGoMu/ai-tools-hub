'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SITE_NAME, NAV_LINKS } from '@/lib/constants';
import SiteLogo from '@/components/ui/SiteLogo';

interface ToolSuggestion {
  slug: string;
  name: string;
  tagline: string;
  url: string;
  category: string[];
}

interface ComparisonSuggestion {
  slug: string;
  title: string;
  toolA: string;
  toolB: string;
}

interface SearchData {
  tools: ToolSuggestion[];
  comparisons: ComparisonSuggestion[];
}

interface Props {
  searchData?: SearchData;
}

export default function Header({ searchData }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const q = searchQuery.toLowerCase().trim();

  const suggestions = useMemo(() => {
    if (!q || !searchData) return { tools: [], comparisons: [] };
    const tools = searchData.tools
      .filter((t) => t.name.toLowerCase().includes(q) || t.tagline.toLowerCase().includes(q))
      .slice(0, 5);
    const comparisons = searchData.comparisons
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 3);
    return { tools, comparisons };
  }, [q, searchData]);

  const hasSuggestions = suggestions.tools.length > 0 || suggestions.comparisons.length > 0;

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setShowDropdown(false);
      setSearchQuery('');
    }
  }

  function handleQueryChange(val: string) {
    setSearchQuery(val);
    setShowDropdown(val.trim().length > 0);
  }

  function handleSuggestionClick() {
    setSearchOpen(false);
    setShowDropdown(false);
    setSearchQuery('');
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <SiteLogo size={30} />
            {SITE_NAME}
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Search button (desktop) */}
          <button
            className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors"
            onClick={() => { setSearchOpen(!searchOpen); setShowDropdown(false); setSearchQuery(''); }}
            aria-label="Search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search
          </button>

          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Desktop search bar with autocomplete */}
        {searchOpen && (
          <div className="hidden md:block border-t border-gray-100 py-3">
            <div ref={searchRef} className="relative">
              <form onSubmit={handleSearchSubmit}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search tools and comparisons…"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </form>

              {showDropdown && hasSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {suggestions.tools.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Tools</p>
                      {suggestions.tools.map((tool) => (
                        <Link
                          key={tool.slug}
                          href={`/tools/${tool.slug}`}
                          onClick={handleSuggestionClick}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${new URL(tool.url).hostname}&sz=32`}
                            alt=""
                            className="w-5 h-5 rounded"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                            <p className="text-xs text-gray-500 truncate">{tool.tagline}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {suggestions.comparisons.length > 0 && (
                    <div className="border-t border-gray-100">
                      <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Comparisons</p>
                      {suggestions.comparisons.map((comp) => (
                        <Link
                          key={comp.slug}
                          href={`/compare/${comp.slug}`}
                          onClick={handleSuggestionClick}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors"
                        >
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <p className="text-sm text-gray-700 truncate">{comp.title}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                  {q.length >= 2 && (
                    <div className="border-t border-gray-100">
                      <Link
                        href={`/search?q=${encodeURIComponent(q)}`}
                        onClick={handleSuggestionClick}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        See all results for &ldquo;{searchQuery}&rdquo;
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {menuOpen && (
          <nav className="md:hidden py-3 border-t border-gray-100 flex flex-col gap-2">
            <form onSubmit={handleSearchSubmit} className="px-2 mb-1">
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </form>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-2 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
