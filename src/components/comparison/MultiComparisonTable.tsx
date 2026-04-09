import { Tool } from '@/lib/types';
import AffiliateCTA from '@/components/tools/AffiliateCTA';
import StarRating from '@/components/ui/StarRating';
import ScoreBar from '@/components/ui/ScoreBar';

interface Props {
  tools: Tool[];
}

function check(val: boolean) {
  return val ? <span className="text-green-500 text-base">✓</span> : <span className="text-red-400 text-base">✗</span>;
}

const stickyCell = 'sticky left-0 z-10 bg-white border-r border-gray-200';
const stickyHeader = 'sticky left-0 z-20 bg-gray-50 border-r border-gray-200';

export default function MultiComparisonTable({ tools }: Props) {
  const sorted = [...tools].sort((a, b) => b.rating - a.rating);
  const topTool = sorted[0];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="text-sm border-collapse" style={{ minWidth: `${160 + sorted.length * 180}px` }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className={`${stickyHeader} px-4 py-4 text-left font-semibold text-gray-500 w-40 text-xs uppercase tracking-wide`}>
              Tool
            </th>
            {sorted.map((tool) => (
              <th key={tool.slug} className="px-4 py-4 text-center font-bold text-gray-900 min-w-[180px]">
                <div className="flex flex-col items-center gap-1.5">
                  <span>{tool.name}</span>
                  {tool.slug === topTool.slug && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Top Rated</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">

          {/* Rating */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Rating</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <StarRating rating={tool.rating} />
                  <span className="text-xs text-gray-500">{tool.rating}/5</span>
                </div>
              </td>
            ))}
          </tr>

          {/* Best For */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Best For</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3 text-center text-xs text-gray-600 leading-relaxed">
                {tool.bestFor ?? <span className="text-gray-400">-</span>}
              </td>
            ))}
          </tr>

          {/* Key Strength */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Key Strength</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3 text-center text-xs text-gray-600 leading-relaxed">
                {tool.keyStrength ?? <span className="text-gray-400">-</span>}
              </td>
            ))}
          </tr>

          {/* Ease of Use */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Ease of Use</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3">
                <ScoreBar score={tool.scores?.easeOfUse} />
              </td>
            ))}
          </tr>

          {/* Learning Curve */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>
              <span>Learning Curve</span>
              <span className="block text-gray-400 font-normal" style={{ fontSize: '10px' }}>5 = easiest</span>
            </td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3">
                <ScoreBar score={tool.scores?.learningCurve} />
              </td>
            ))}
          </tr>

          {/* Starting Price */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Starting Price</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3 text-center text-gray-700 font-medium text-xs">
                {tool.pricing.startingPrice ?? 'Free'}
              </td>
            ))}
          </tr>

          {/* Free Plan */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Free Plan</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3 text-center">
                {check(tool.pricing.hasFree)}
              </td>
            ))}
          </tr>

          {/* Top Features */}
          <tr className="hover:bg-gray-50">
            <td className={`${stickyCell} px-4 py-3 font-medium text-gray-700 text-xs`}>Top Features</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3">
                <ul className="space-y-1">
                  {tool.features.slice(0, 3).map((f) => (
                    <li key={f} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>

          {/* Try It */}
          <tr className="bg-gray-50">
            <td className={`${stickyCell} bg-gray-50 px-4 py-3 font-medium text-gray-700 text-xs`}>Try it</td>
            {sorted.map((tool) => (
              <td key={tool.slug} className="px-4 py-3">
                <AffiliateCTA tool={tool} size="sm" label={tool.pricing.hasFree ? 'Try Free →' : 'Get Started →'} />
              </td>
            ))}
          </tr>

        </tbody>
      </table>
    </div>
  );
}
