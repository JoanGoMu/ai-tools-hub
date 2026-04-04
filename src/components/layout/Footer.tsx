import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-3">🤖 {SITE_NAME}</h3>
            <p className="text-sm leading-relaxed">
              Independent comparisons and reviews of the best AI tools. Updated regularly.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Categories</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/category/ai-writing" className="hover:text-white transition-colors">AI Writing</Link></li>
              <li><Link href="/category/ai-image" className="hover:text-white transition-colors">AI Image Generation</Link></li>
              <li><Link href="/category/ai-code" className="hover:text-white transition-colors">AI Coding</Link></li>
              <li><Link href="/category/ai-video" className="hover:text-white transition-colors">AI Video</Link></li>
              <li><Link href="/category/ai-audio" className="hover:text-white transition-colors">AI Audio & Voice</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Site</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/deals" className="hover:text-white transition-colors">Deals & Discounts</Link></li>
              <li><Link href="/tools" className="hover:text-white transition-colors">All Tools</Link></li>
              <li><Link href="/disclosure" className="hover:text-white transition-colors">Affiliate Disclosure</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 text-xs text-gray-500">
          <p>
            ⚠️ <strong className="text-gray-400">Affiliate Disclosure:</strong> Some links on this site are affiliate links.
            We may earn a commission at no extra cost to you when you sign up through our links. This helps keep the site free.{' '}
            <Link href="/disclosure" className="underline hover:text-gray-300">Learn more</Link>.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
