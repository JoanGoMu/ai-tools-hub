'use client';

import { useEffect, useRef } from 'react';

export default function BlogComments() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || ref.current.querySelector('iframe')) return;

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'JoanGoMu/ai-tools-hub');
    script.setAttribute('data-repo-id', 'R_kgDOR5drwg');
    script.setAttribute('data-category', 'General');
    script.setAttribute('data-category-id', 'DIC_kwDOR5drws4C6GQK');
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-lang', 'en');
    script.setAttribute('data-input-position', 'bottom');
    script.setAttribute('data-loading', 'lazy');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    ref.current.appendChild(script);
  }, []);

  return (
    <div className="mt-14 pt-8 border-t border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Comments</h2>
      <div ref={ref} />
    </div>
  );
}
