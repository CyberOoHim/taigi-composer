# Project Guidelines

- **Development Workflow**: Use `npm run dev` (or `bun run dev`) instead of `npm run build` when possible for faster iteration and live Hot Module Replacement (HMR).
- **Fast Pre-Commit Verification**: Use `bun run lint && bun run typecheck` for pre-commit verification. Do NOT run full `bun run build` before routine commits unless specifically testing build packaging or static export, as full Next.js builds are resource-intensive on low-resource environments.
- **Static Export & API Routes**: GitHub Actions builds with `STATIC_EXPORT=true` (`output: 'export'`). Never set `export const dynamic = 'force-dynamic'` on route handlers (use `force-static` for `/api/gemini/auth-status` and avoid dynamic flags on POST routes) to prevent static export build failures.

## Agent Skills
- **`sheet-music-to-json`**: Located at `.agents/skills/sheet-music-to-json/` (and `.agents/sheet-music-to-json/`). Converts musical sheet images (PNG, JPG, WEBP) or PDF documents into the app's standard Song JSON format (`*.taigi.json`).
  - Run converter: `node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs <file-or-files> [options]`
  - Run validator: `node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs <song.json>`
  - Documentation: See `.agents/skills/sheet-music-to-json/SKILL.md`

