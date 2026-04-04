interface Props {
  pros: string[];
  cons: string[];
}

export default function ProsCons({ pros, cons }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="bg-green-50 rounded-xl p-6">
        <h3 className="font-bold text-green-800 mb-3">👍 Pros</h3>
        <ul className="space-y-2">
          {pros.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-green-700">
              <span className="mt-0.5">✓</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-red-50 rounded-xl p-6">
        <h3 className="font-bold text-red-800 mb-3">👎 Cons</h3>
        <ul className="space-y-2">
          {cons.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-red-700">
              <span className="mt-0.5">✗</span>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
