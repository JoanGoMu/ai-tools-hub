import Link from 'next/link';
import { Tool } from '@/lib/types';
import AffiliateCTA from './AffiliateCTA';
import StarRating from '@/components/ui/StarRating';

interface Props {
  tool: Tool;
}

export default function ToolCard({ tool }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/tools/${tool.slug}`} className="font-bold text-lg text-gray-900 hover:text-indigo-600">
            {tool.name}
          </Link>
          <p className="text-sm text-gray-500 mt-0.5">{tool.tagline}</p>
        </div>
        {tool.pricing.hasFree && (
          <span className="shrink-0 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Free plan
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StarRating rating={tool.rating} />
        <span className="text-sm text-gray-500">{tool.rating.toFixed(1)}</span>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">{tool.description}</p>

      <div className="flex flex-wrap gap-1 mt-auto">
        {tool.features.slice(0, 3).map((f) => (
          <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {f}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          {tool.pricing.hasFree ? 'Free + paid plans' : `From ${tool.pricing.startingPrice}`}
        </span>
        <AffiliateCTA tool={tool} size="sm" />
      </div>
    </div>
  );
}
