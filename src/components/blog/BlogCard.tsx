import Link from 'next/link';
import { BlogPost } from '@/lib/types';

interface Props {
  post: BlogPost;
}

export default function BlogCard({ post }: Props) {
  const date = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="bg-white border border-gray-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col"
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {post.tags.map((tag) => (
          <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <h2 className="font-bold text-gray-900 text-lg leading-snug">{post.title}</h2>
      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{post.excerpt}</p>
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-400">{date}</span>
        <span className="text-xs font-medium text-indigo-600">Read more →</span>
      </div>
    </Link>
  );
}
