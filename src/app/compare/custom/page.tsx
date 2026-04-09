import { Metadata } from 'next';
import { getAllTools, getAllCategories } from '@/lib/data';
import CustomComparePage from './CustomComparePage';

export const metadata: Metadata = {
  title: 'Custom AI Tool Comparison | AI Tools Hub',
  description: 'Pick any AI tools you want and compare them side by side. Ratings, pricing, ease of use, features and more.',
};

export default function CustomCompare() {
  const tools = getAllTools();
  const categories = getAllCategories();
  return <CustomComparePage tools={tools} categories={categories} />;
}
