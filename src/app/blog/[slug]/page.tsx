import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts, getBlogPostBySlug } from '@/lib/data';
import { blogPostMetadata } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import BlogComments from '@/components/blog/BlogComments';

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
    author: { '@type': 'Organization', name: 'AIToolCrunch' },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-8 flex items-center gap-2">
          <Link href="/" className="hover:text-indigo-600">Home</Link>
          <span>›</span>
          <Link href="/blog" className="hover:text-indigo-600">Blog</Link>
          <span>›</span>
          <span className="text-gray-800 line-clamp-1">{post.title}</span>
        </nav>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2.5 py-1 rounded-full uppercase tracking-wide">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-4">{post.title}</h1>

        <p className="text-lg text-gray-500 mb-4 leading-relaxed">{post.excerpt}</p>

        <p className="text-sm text-gray-400 mb-8 pb-8 border-b border-gray-100">
          {date}
        </p>

        {post.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full rounded-xl mb-10 object-cover"
            style={{ maxHeight: '420px' }}
          />
        )}

        <div
          className="prose prose-lg prose-gray max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-headings:mt-10 prose-headings:mb-4 prose-p:leading-8 prose-p:text-gray-700 prose-p:mb-6 prose-li:text-gray-700 prose-li:leading-7 prose-a:text-indigo-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-h2:text-2xl prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-3 prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600 prose-blockquote:not-italic prose-img:rounded-lg prose-img:my-6 prose-figcaption:text-center prose-figcaption:text-sm prose-figcaption:text-gray-500 prose-figcaption:mt-2 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-code:before:content-none prose-code:after:content-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <BlogComments />

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Some links in this article are affiliate links.{' '}
            <Link href="/disclosure" className="underline">Learn more</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
