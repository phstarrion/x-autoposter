# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

X Autoposter is a Next.js (App Router) tool for posting and scheduling posts to X (Twitter), with an
AI agent pipeline that drafts post copy. The UI and comments are largely in Japanese; user-facing
error strings are intentionally Japanese.

Two largely independent subsystems share one repo:
1. **Web app** (`app/`) — Next.js frontend + API routes that post immediately, schedule posts, manage
   drafts, and upload media. Deployed to Vercel.
2. **Agent pipeline** (`scripts/`, `agents/`) — a standalone CLI batch run that turns input memos into
   post drafts and writes them to Supabase.

## Commands

```bash
npm run dev          # Start Next.js dev server at http://localhost:3000
npm run build        # Production build (also Vercel's build command)
npm run start        # Serve the production build
npm run lint         # ESLint (eslint-config-next, core-web-vitals + typescript)
npm run agents       # Run the planner→writer→checker agent pipeline (tsx scripts/run_agents.ts)
./run_agents.sh      # Wrapper around `npm run agents`, cd's into repo root first

# Scripts without npm aliases — run directly with tsx (devDependency):
npx tsx verify_db.ts                            # Smoke-test Supabase connection to scheduled_posts
npx tsx scripts/import_generated_image.ts <file.json>   # Upload a generated image + its x_caption as a draft
```

There is no test suite. There is no single-test command. `verify_db.ts` is the closest thing to a
DB integration check.

## Environment

Configuration is read from `.env.local` (gitignored). The agent scripts load it explicitly via
`dotenv`; Next.js loads it automatically.

- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` — X API v1/v2 (OAuth 1.0a)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase (service role; server-side only)
- `OPENAI_API_KEY` — agent pipeline LLM calls
- `LLM_PROVIDER` — defaults to `openai` (only provider implemented; see `getProvider` switch)
- `MOCK_MODE` — `"true"` makes every API route simulate behavior without touching X or (mostly) Supabase
- `VERCEL_URL` — used to build absolute URLs for internal fetches

### MOCK_MODE is a first-class code path

`MOCK_MODE=true` is checked at the top of nearly every API route (`post`, `cron`, `schedule`,
`scheduled-posts`, `upload`). In mock mode:
- Posting returns a fake `tweetId`; including the word `error` in text forces a simulated failure.
- Scheduled posts live in an **in-memory array** (`mockPostsStore` in `app/api/scheduled-posts/route.ts`),
  not Supabase — it resets on server restart and is not shared across serverless instances.
- `upload` returns a `picsum.photos` placeholder URL.

When adding or changing an API route, preserve the mock branch and keep its behavior parallel to the
real branch, otherwise mock-mode development breaks.

## Architecture

### Posting flow (web)

- `POST /api/post` — immediate post. Uploads media via `client.v1.uploadMedia` (X v1 endpoint), then
  tweets via `client.v2.tweet`. Media is supplied as `{url, type}[]`; the route fetches each URL,
  buffers it, infers MIME from the extension, and uploads. Real errors are logged but the client only
  ever receives a generic Japanese message.
- `POST /api/schedule` — inserts a row into Supabase `scheduled_posts` with `status='pending'` and
  `sort_order=Date.now()`. The frontend sends `scheduledAt` as an ISO string with timezone already
  resolved; the route stores it verbatim.
- `GET /api/cron` — the scheduler worker. Selects `pending` posts where `scheduled_at <= now`, posts
  each (same media-upload logic as `/api/post`), then updates each row to `sent` (with `tweet_id`) or
  `failed`. **The media-upload block is duplicated between `/api/post` and `/api/cron`** — change both
  together.

Two cron triggers exist and both hit `GET /api/cron`:
- `vercel.json` → Vercel cron, daily at `0 0 * * *`.
- `.github/workflows/cron.yml` → GitHub Actions every 5 minutes, `curl`s `${VERCEL_URL}/api/cron`
  (uses the `VERCEL_URL` repo secret). This 5-minute job is the real driver of timely scheduled posts.

### Scheduled-posts management

`app/api/scheduled-posts/route.ts` is a single multi-method route:
- `GET` — list, ordered by `sort_order` then `scheduled_at`.
- `POST` — mock-only insert into the in-memory store (real inserts go through `/api/schedule`).
- `PUT` — edit a `pending` post; enforces 280-char limit and future-date validation; only updates rows
  with `status='pending'`.
- `DELETE` — single delete by `id`, or `?action=clear_history` to bulk-delete `sent`/`failed` rows.

`app/api/scheduled-posts/reorder/route.ts` — `POST { items: [{id, sort_order, scheduled_at?}] }`,
updates `sort_order` (and optionally swaps `scheduled_at`) for drag-and-drop reordering on the home page
(`@dnd-kit`).

### Drafts

Drafts are AI-generated post candidates stored in the Supabase `drafts` table.
- `GET/DELETE /api/drafts` — list latest 50 / delete by id.
- `GET /api/drafts/latest` — most recent single draft.
- The agent pipeline and `import_generated_image.ts` are the writers of this table.

### Agent pipeline (`scripts/run_agents.ts`)

Sequential chain: **Planner → Writer → Checker**, each an LLM call whose system prompt is the
corresponding `agents/<name>.md` file (plus any policies). The flow:

1. Read the **most recently modified** `.md` in `inputs/` (by mtime — there's no explicit selection).
2. Concatenate all `.md` files in `policies/` (directory is optional; not present by default) onto every
   agent's system prompt.
3. Run each agent; each must return JSON matching the contract documented in its `agents/*.md` file.
   `parseJsonResponse` strips ```` ```json ```` fences before `JSON.parse`.
4. The Checker's `final_text` is written to `outputs/final_<timestamp>.txt`, and a draft row is inserted
   into Supabase (`source='agents'`, `meta=checkerResult`).
5. Media is extracted from the input via the regex `/managed_images/...png|jpg|...` — i.e. referencing a
   file under `public/managed_images/` in the input memo attaches it to the draft.
6. All intermediate JSON is saved to `outputs/<agent>_<timestamp>.json`; a run log goes to
   `logs/run_<timestamp>.log`. These are gitignored except `.gitkeep`.

Agent behavior is changed by editing the markdown in `agents/`, **not** code. The JSON shape each agent
must emit is defined in those files; if you change a downstream consumer (e.g. expecting `final_text`
or `ready_to_post` from the checker), update the agent prompt to match.

The LLM layer is abstracted in `scripts/lib/llm-provider.ts` (`LLMProvider` interface,
`OpenAIProvider`, `getProvider` factory). Adding a provider = implement the interface and add a `case`
to the switch; default model is `gpt-4o-mini`.

### Supabase

`lib/supabase.ts` exports a nullable singleton (`null` when env vars are absent) — always null-check it.
Some routes (`drafts`, `reorder`) instead construct their own client via a local `getSupabaseClient()`
and set `runtime = "nodejs"` + `dynamic = "force-dynamic"`; follow that pattern for new routes that must
not be statically optimized or edge-bundled.

Schema lives in `supabase/*.sql` and is applied manually in the Supabase SQL editor (no migration tool):
- `schema.sql` — `scheduled_posts` (base).
- `drafts.sql` — `drafts` table.
- `add_sort_order.sql` — adds `scheduled_posts.sort_order` (drag-and-drop).
- `add_media_jsonb.sql` — adds `media jsonb` to both tables.

Media is a JSONB array of `{url: string, type: "image" | "video"}` on both `scheduled_posts` and
`drafts`. Uploaded files go to the Supabase Storage bucket named `uploads`.

### Shared types

`types/api.ts` holds the canonical `ScheduledPost`, `Draft`, and `PostResponse` types used by both the
frontend and the routes. Note `app/api/drafts/latest/route.ts` re-declares a local `Draft` — the shared
one in `types/api.ts` is the source of truth.

### Scheduling logic

`lib/schedule.ts` computes the next default schedule slot for the UI. Fixed JST slots are 07:30, 12:10,
21:30; `getNextSlot()` picks the next future slot (rolling to tomorrow's first slot if all today's have
passed) and adds randomized jitter (±3–7 min) to avoid posting on exact-minute boundaries. All time math
is done manually in UTC with a +9h JST offset — there is no date library.

## Conventions

- The `@/*` path alias maps to the repo root (`tsconfig.json`).
- TypeScript is `strict`; routes commonly use `catch (e: any)` and cast X API media types `as any` where
  the library's types lag — match the surrounding style rather than fighting it.
- The 280-character X limit is enforced/asserted in multiple places (agent prompts, `PUT` validation);
  keep them consistent.
- Image generation: `public/managed_images/theme_*.png` are pre-made themed images referenced by name
  from input memos to attach media to agent-generated drafts.
