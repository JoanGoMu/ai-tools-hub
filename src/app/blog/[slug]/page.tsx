import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts, getBlogPostBySlug } from '@/lib/data';
import { blogPostMetadata } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return getAllBlogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPostBySlug(params.slug);
  if (!post) return {};
  return blogPostMetadata(post);
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPostBySlug(params.slug);
  if (!post) notFound();

  const date = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: { '@type': 'Organization', name: post.author },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-indigo-600">Home</Link>
          <span>›</span>
          <Link href="/blog" className="hover:text-indigo-600">Blog</Link>
          <span>›</span>
          <span className="text-gray-800 line-clamp-1">{post.title}</span>
        </nav>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">{post.title}</h1>

        <p className="text-sm text-gray-400 mb-8">
          By {post.author} · {date}
        </p>

        <div
          className="prose prose-gray max-w-none prose-headings:font-bold prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Some links in this article are affiliate links.{' '}
            <Link href="/disclosure" className="underline">Learn more</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
