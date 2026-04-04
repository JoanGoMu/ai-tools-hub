# AIToolCrunch — Claude Context

## What this project is

An affiliate comparison website for AI tools at **aitoolcrunch.com**. Revenue model: affiliate commissions (20-45% recurring) when users sign up for AI tools via links on the site. The site compares tools across 5 categories: AI Writing, AI Image, AI Code, AI Video, AI Audio.

**Owner:** Joan Gomez Mussone  
**Goal:** Passive income project that Claude can mostly build and maintain, with zero/low running costs.

## Key URLs and accounts

- **Live site:** https://aitoolcrunch.com
- **Netlify:** ai-tools-hub-joan.netlify.app (project: ai-tools-hub-joan)
- **GitHub:** https://github.com/JoanGoMu/ai-tools-hub (private)
- **Domain registrar:** Porkbun (~$11/year renewal)
- **Google Search Console:** verified, sitemap at https://aitoolcrunch.com/sitemap.xml

## Tech stack

- **Next.js 14** (static export, `output: 'export'`) + TypeScript + Tailwind CSS
- **Data store:** JSON files in `data/` — no database
- **Hosting:** Netlify free tier — auto-deploys on every push to `main`
- **Automation:** GitHub Actions cron daily at 6am UTC
- **Node.js:** Homebrew at `/opt/homebrew/opt/node@20/bin/` — always run `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"` first

## How to deploy any change

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd /Users/joan.mussone/Desktop/Projects/ai-tools-hub
git add .
git commit -m "description"
git push
# Netlify auto-deploys in ~1 min
```

## Current site content

**24 tools:** jasper, copy-ai, writesonic, rytr, midjourney, dall-e, leonardo-ai, ideogram, github-copilot, cursor, tabnine, runway, synthesia, heygen, pika, elevenlabs, descript, murf-ai, fluently, mercury-edit, slide2video, voiceos, apimage, generateppt

**9 comparisons:** jasper-vs-copy-ai, jasper-vs-writesonic, cursor-vs-github-copilot, midjourney-vs-dall-e, elevenlabs-vs-murf-ai, runway-vs-pika, synthesia-vs-heygen, copy-ai-vs-jasper, copy-ai-vs-writesonic

**5 categories:** ai-writing, ai-image, ai-code, ai-video, ai-audio

**Total: ~48 static pages**

## How to add a new tool

1. Create `data/tools/slug-name.json` using this schema:

```json
{
  "slug": "tool-name",
  "name": "Tool Name",
  "tagline": "One line description",
  "description": "2-3 paragraph description",
  "category": ["ai-writing"],
  "url": "https://tool.com/",
  "affiliateUrl": null,
  "affiliateProgram": {
    "network": "partnerstack",
    "commissionType": "recurring",
    "commissionRate": "30%",
    "cookieDuration": "90 days"
  },
  "pricing": {
    "hasFree": true,
    "startingPrice": "$20/mo",
    "plans": [
      { "name": "Free", "price": "$0", "billingCycle": "forever", "features": ["..."] },
      { "name": "Pro", "price": "$20/mo", "billingCycle": "monthly", "features": ["..."] }
    ]
  },
  "features": ["Feature 1", "Feature 2"],
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1", "Con 2"],
  "rating": 4.5,
  "logoUrl": "/images/tools/tool-name.png",
  "screenshotUrl": null,
  "lastUpdated": "2026-04-04",
  "source": "manual",
  "status": "active",
  "featured": false
}
```

2. Push → page live at aitoolcrunch.com/tools/slug-name

## How to add a comparison

Add an entry to `data/comparisons.json`:

```json
{
  "slug": "tool-a-vs-tool-b",
  "toolA": "tool-a-slug",
  "toolB": "tool-b-slug",
  "title": "Tool A vs Tool B: Which is Better in 2026?",
  "verdict": "Summary of which wins and why.",
  "winner": "tool-a-slug"
}
```

Push → page live at aitoolcrunch.com/compare/tool-a-vs-tool-b

## Affiliate programs

All in `data/affiliate-links.json` with `"status": "pending"`. When approved:
1. Add real affiliate URL to the entry
2. Change `"status"` to `"active"`
3. Push → entire site rebuilds with monetized links

| Tool | Commission | Apply at |
|------|-----------|----------|
| Copy.ai | 45% first year, 20% lifetime | partners.copy.ai |
| Writesonic | 30% lifetime recurring | writesonic.com/affiliates |
| ElevenLabs | 22% recurring | elevenlabs.io/affiliates |
| Jasper | 30% recurring 1yr | app.impact.com |
| Synthesia | 20% recurring | synthesia.partnerstack.com |

## GitHub Actions scraper

- Runs daily at **6am UTC** (8am Spain time)
- Saves new tool suggestions → `data/scraped-suggestions.json`
- Saves AI news → `data/rss-feed-items.json`
- Auto-commits changes to GitHub
- After it runs: `git pull` to see results locally
- Manual trigger: GitHub → Actions → "Daily Tool Scraper" → "Run workflow"

## Weekly RSS review workflow

Joan reviews `data/rss-feed-items.json` weekly (not daily). To show only items since last review:

1. Read `data/review-log.json` — `lastReviewedAt` is the cutoff date, `reviewedLinks` lists all already-seen links
2. Filter `rss-feed-items.json` for items whose `link` is NOT in `reviewedLinks`
3. Present candidates: Product Hunt tools that fit categories (ai-writing, ai-image, ai-code, ai-video, ai-audio). Skip news articles, infrastructure posts, non-tool products.
4. After review: update `review-log.json` — set new `lastReviewedAt`, add new links to `reviewedLinks`, record decisions
5. For chosen tools: create `data/tools/slug.json` file and push

**Candidate tools from April 4 2026 review (not yet added):**
- `fluently` — YouTube subtitles/transcription → ai-audio
- `mercury-edit` — AI video editing → ai-video  
- `slide2video` — Presentations to video → ai-video
- `voiceos` — Voice AI platform → ai-audio
- `apimage` — AI image generation → ai-image
- `generateppt` — AI presentation/writing → ai-writing

## Open tasks (next steps)

### Immediate — revenue
- [ ] Apply for affiliate programs (Copy.ai first, easiest approval)
- [ ] Update `data/affiliate-links.json` when approved

### Growth
- [ ] Add more tool pages (review `data/scraped-suggestions.json` weekly)
- [ ] Add more comparison pages (highest SEO value)
- [ ] Share on Reddit: r/artificial, r/SideProject, r/MachineLearning
- [ ] Set up Google Analytics 4

### Future automation
- [ ] Claude API in GitHub Actions for fully automated content generation
  - Needs Anthropic API key (separate from Claude Pro, pay-as-you-go)
  - claude-haiku-4-5 ~$0.01 per tool page generated

## Known issues / past decisions

- **Cloudflare Pages failed** — their new UI uses OpenNext which requires Next.js 15+. Using Netlify instead.
- **Node.js path** — always need `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"`
- **scripts/ excluded from tsconfig** — avoids build errors from scraper TypeScript
- **RSS scraper timeout** — fixed with 15s per-feed timeout wrapper (was hanging indefinitely)
- **HTTPS** — auto-provisioned by Netlify after DNS propagation (~24h)
