import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'Read our affiliate disclosure policy.',
};

export default function DisclosurePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Affiliate Disclosure</h1>
      <div className="prose prose-gray max-w-none space-y-4 text-gray-600 leading-relaxed">
        <p>
          <strong>{SITE_NAME}</strong> participates in affiliate marketing programs. This means that
          when you click a link on our site and make a purchase or sign up for a service, we may
          receive a commission at <strong>no additional cost to you</strong>.
        </p>
        <p>
          Our editorial reviews and comparisons are independent. We are not paid to write positive
          reviews. Affiliate relationships do not influence our ratings, recommendations, or content.
          We only recommend tools we believe provide genuine value.
        </p>
        <p>
          Pages that contain affiliate links are labeled with a disclosure notice. All affiliate
          links include the <code>rel=&quot;nofollow sponsored&quot;</code> attribute as required by Google&apos;s
          guidelines.
        </p>
        <p>
          This disclosure is provided in accordance with the U.S. Federal Trade Commission (FTC)
          guidelines on endorsements and testimonials.
        </p>
        <p>
          If you have questions about our affiliate relationships, contact us through our GitHub
          repository or the contact information provided on the site.
        </p>
        <p className="text-sm text-gray-400">Last updated: April 2026</p>
      </div>
    </div>
  );
}
