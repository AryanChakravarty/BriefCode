# Ticket Brief

Generate structured briefings from GitHub PR URLs in under a minute. Paste a PR link, get an overview, changed files, risks, and review guidance — with optional AI enhancement via OpenAI.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (22 recommended)
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) (for local Postgres), or any Postgres instance

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Start Postgres
docker compose up -d

# 4. Create database tables
pnpm db:push

# 5. Run API + frontend together
pnpm dev
```

Open **http://localhost:5173** in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API (port 3001) and frontend (port 5173) |
| `pnpm dev:api` | API server only |
| `pnpm dev:web` | Frontend only |
| `pnpm db:push` | Push Drizzle schema to Postgres |
| `pnpm build` | Typecheck and build all packages |
| `pnpm typecheck` | Run TypeScript across the workspace |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `PORT` | No | API port (default `3001`) |
| `OPENAI_API_KEY` | No | Enables AI briefings; without it, raw PR data is shown |
| `GITHUB_TOKEN` | No | Needed for private repos / higher GitHub rate limits |
| `JIRA_*` | No | Jira is stubbed — returns a placeholder briefing |

## Project structure

```
artifacts/
  api-server/     Express 5 REST API
  ticket-brief/   React + Vite frontend
lib/
  api-spec/       OpenAPI contract (source of truth)
  api-client-react/  Generated React Query hooks
  api-zod/        Generated Zod schemas
  db/             Drizzle ORM + Postgres schema
```

## How it works

1. Paste a public GitHub PR URL (e.g. `https://github.com/org/repo/pull/123`)
2. The API fetches PR metadata, files, and commits from GitHub
3. If `OPENAI_API_KEY` is set, GPT-4o-mini generates a structured briefing
4. Otherwise, a deterministic fallback summary is returned
5. Briefings are stored in Postgres and appear on the History page

The frontend dev server proxies `/api` requests to the API on port 3001.

## Regenerating API client

After changing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```
