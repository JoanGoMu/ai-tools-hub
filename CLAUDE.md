# AIToolCrunch - Project Instructions

**IMPORTANT: At the start of every conversation, read the project memory at:**
`/Users/joan.mussone/.claude/projects/-Users-joan-mussone-Desktop-Projects/memory/project_aitoolcrunch.md`

**At the end of every conversation where you make changes, update that memory file with any new tools added, comparisons created, or status changes.**

## Project structure

- **Live site:** https://aitoolcrunch.com
- **Repo:** https://github.com/JoanGoMu/ai-tools-hub (private)
- **Hosting:** Vercel (auto-deploys on git push)
- **Stack:** Next.js 14 static export + TypeScript + Tailwind

## Critical rules

1. **No em dashes** - Never use "-" in any content. Use "-" or rewrite.
2. **No leading spaces** in text content fields.
3. **Every new tool must get comparison pages** - when adding a tool, also add comparisons vs related tools in the same commit.
4. **Blog author format** - use display name ("Alex Chen") not slug in "author" field.
5. **Node.js path** - must use `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"` in terminal.
6. **Data only** - all content lives in `data/` JSON files, no database.

## Common commands

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd /Users/joan.mussone/Desktop/Projects/ai-tools-hub
npm run build   # test build
git add . && git commit -m "description" && git push  # deploy (Vercel auto-deploys)
```

## Adding content

- **New tool:** create `data/tools/slug.json` using schema in project_aitoolcrunch.md
- **New comparison:** add entry to `data/comparisons.json`
- **Deploy:** just push - Vercel handles the rest
