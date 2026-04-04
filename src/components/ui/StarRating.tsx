interface Props {
  rating: number;
  max?: number;
}

export default function StarRating({ rating, max = 5 }: Props) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <svg
            key={i}
            className={`w-4 h-4 ${filled ? 'text-yellow-400' : half ? 'text-yellow-300' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.166c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118L10 15.347l-3.354 2.436c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.363-1.118L2.66 9.393c-.783-.57-.38-1.81.588-1.81h4.166a1 1 0 00.95-.69l1.286-3.966z" />
          </svg>
        );
      })}
    </div>
  );
}
