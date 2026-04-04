import { Tool } from '@/lib/types';
import AffiliateCTA from '@/components/tools/AffiliateCTA';
import StarRating from '@/components/ui/StarRating';

interface Props {
  toolA: Tool;
  toolB: Tool;
  winner?: string;
}

function check(val: boolean) {
  return val ? '✅' : '❌';
}

export default function ComparisonTable({ toolA, toolB, winner }: Props) {
  const rows = [
    { label: 'Rating', a: <StarRating rating={toolA.rating} />, b: <StarRating rating={toolB.rating} /> },
    { label: 'Starting Price', a: toolA.pricing.startingPrice ?? 'N/A', b: toolB.pricing.startingPrice ?? 'N/A' },
    { label: 'Free Plan', a: check(toolA.pricing.hasFree), b: check(toolB.pricing.hasFree) },
    { label: 'Category', a: toolA.category.join(', '), b: toolB.category.join(', ') },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-6 py-4 text-left font-semibold text-gray-600 w-1/3"></th>
            <th className="px-6 py-4 text-center font-bold text-gray-900 w-1/3">
              {toolA.name}
              {winner === toolA.slug && (
                <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Winner</span>
              )}
            </th>
            <th className="px-6 py-4 text-center font-bold text-gray-900 w-1/3">
              {toolB.name}
              {winner === toolB.slug && (
                <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Winner</span>
              )}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.label} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-700">{row.label}</td>
              <td className="px-6 py-4 text-center text-gray-600">{row.a}</td>
              <td className="px-6 py-4 text-center text-gray-600">{row.b}</td>
            </tr>
          ))}
          <tr>
            <td className="px-6 py-4 font-medium text-gray-700">Top Features</td>
            <td className="px-6 py-4">
              <ul className="space-y-1">
                {toolA.features.slice(0, 4).map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
            </td>
            <td className="px-6 py-4">
              <ul className="space-y-1">
                {toolB.features.slice(0, 4).map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
          <tr className="bg-gray-50">
            <td className="px-6 py-4 font-medium text-gray-700">Try it</td>
            <td className="px-6 py-4 text-center">
              <AffiliateCTA tool={toolA} size="sm" />
            </td>
            <td className="px-6 py-4 text-center">
              <AffiliateCTA tool={toolB} size="sm" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
