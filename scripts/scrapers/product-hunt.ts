/**
 * Product Hunt scraper – fetches today's AI-related posts via the public GraphQL API.
 * Writes new tool stubs to data/scraped-suggestions.json for manual review.
 * Never overwrites existing tool files.
 */
import fs from 'fs';
import path from 'path';

const SUGGESTIONS_FILE = path.join(process.cwd(), 'data', 'scraped-suggestions.json');
const TOOLS_DIR = path.join(process.cwd(), 'data', 'tools');

interface PHPost {
  slug: string;
  name: string;
  tagline: string;
  url: string;
  topics: { name: string }[];
  votesCount: number;
}

interface PHResponse {
  data: {
    posts: {
      edges: { node: PHPost }[];
    };
  };
}

async function fetchAIPostsFromProductHunt(): Promise<PHPost[]> {
  const query = `
    query {
      posts(topic: "artificial-intelligence", order: VOTES, first: 20) {
        edges {
          node {
            slug
            name
            tagline
            url
            votesCount
            topics(first: 5) {
              name
            }
          }
        }
      }
    }
  `;

  const token = process.env.PRODUCT_HUNT_TOKEN;
  const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    console.error(`Product Hunt API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = (await res.json()) as PHResponse;
  return data.data?.posts?.edges?.map((e) => e.node) ?? [];
}

async function main() {
  console.log('Fetching AI tools from Product Hunt...');
  const posts = await fetchAIPostsFromProductHunt();

  if (posts.length === 0) {
    console.log('No posts fetched.');
    return;
  }

  // Load existing suggestions
  const existing: PHPost[] = fs.existsSync(SUGGESTIONS_FILE)
    ? JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf-8'))
    : [];

  const existingSlugs = new Set(existing.map((p) => p.slug));

  // Also skip tools that already have a full JSON file
  const existingToolFiles = new Set(
    fs.readdirSync(TOOLS_DIR).map((f) => f.replace('.json', ''))
  );

  const newPosts = posts.filter(
    (p) => !existingSlugs.has(p.slug) && !existingToolFiles.has(p.slug)
  );

  if (newPosts.length === 0) {
    console.log('No new AI tools found on Product Hunt today.');
    return;
  }

  const updated = [...existing, ...newPosts];
  // Keep only the last 100 suggestions to avoid unbounded growth
  const trimmed = updated.slice(-100);
  fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(trimmed, null, 2));

  console.log(`Added ${newPosts.length} new tool suggestions from Product Hunt.`);
  newPosts.forEach((p) => console.log(`  - ${p.name}: ${p.tagline}`));
}

main().catch(console.error);
