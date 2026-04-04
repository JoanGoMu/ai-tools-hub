import { Tool } from '@/lib/types';

interface Props {
  tool: Tool;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export default function AffiliateCTA({ tool, size = 'md', label }: Props) {
  const href = tool.affiliateUrl ?? tool.url;
  const buttonLabel = label ?? (tool.pricing.hasFree ? `Try ${tool.name} Free` : `Get ${tool.name}`);

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer sponsored"
      className={`inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors ${sizeClasses[size]}`}
    >
      {buttonLabel} →
    </a>
  );
}
