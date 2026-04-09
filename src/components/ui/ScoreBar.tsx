interface Props {
  score: number | undefined;
  max?: number;
}

export default function ScoreBar({ score, max = 5 }: Props) {
  if (score == null) return <span className="text-gray-400 text-sm">-</span>;

  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-sm ${i < Math.round(score) ? 'bg-indigo-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">{score.toFixed(1)}</span>
    </div>
  );
}
