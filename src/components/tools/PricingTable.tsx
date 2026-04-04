import { Tool } from '@/lib/types';
import AffiliateCTA from './AffiliateCTA';

interface Props {
  tool: Tool;
}

export default function PricingTable({ tool }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{tool.name} Pricing</h2>
      {tool.pricing.hasFree && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2 mb-6 inline-flex items-center gap-2">
          ✅ {tool.name} has a <strong>free plan</strong> — no credit card required to start.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tool.pricing.plans.map((plan, i) => (
          <div
            key={plan.name}
            className={`border rounded-xl p-6 flex flex-col gap-4 ${i === 1 ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}
          >
            {i === 1 && (
              <span className="text-xs font-semibold bg-indigo-600 text-white px-3 py-0.5 rounded-full self-start">
                Most Popular
              </span>
            )}
            <div>
              <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
              <div className="mt-1">
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                {plan.billingCycle && plan.price !== '$0' && plan.price !== 'Custom' && (
                  <span className="text-sm text-gray-500 ml-1">/{plan.billingCycle}</span>
                )}
              </div>
            </div>
            <ul className="space-y-2 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <AffiliateCTA tool={tool} size="sm" label={plan.price === '$0' ? 'Start Free' : `Get ${plan.name}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
