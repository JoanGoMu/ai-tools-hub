import { Metadata } from 'next';
import { getAllBlogPosts } from '@/lib/data';
import BlogCard from '@/components/blog/BlogCard';

export const metadata: Metadata = {
  title: 'AI Tools Blog — Tips, Stories & Comparisons',
  description: 'Real-world AI success stories, tool comparisons, and practical guides to help you get the most from AI tools in 2026.',
};

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Blog</h1>
      <p className="text-gray-500 mb-10">
        Real-world AI stories, tool comparisons, and practical guides.
      </p>

      {posts.length === 0 ? (
        <p className="text-gray-400">No posts yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
