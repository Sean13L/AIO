# worker

The container half of the hybrid architecture. `web/` (the Next.js app) is
built to deploy serverless — stateless requests, no local disk, no
long-running processes. Two things structurally can't work that way, so
they live here instead, in an always-on process:

- **File storage** — uploaded lecture slides and archived syllabus files,
  on a persistent volume (`STORAGE_ROOT`, mounted at `/data` in the
  Docker image). `web/` never touches a filesystem for these; it calls
  this service over HTTP (see `web/lib/workerClient.ts`).
- **The preview-generation scheduler** — the polling loop that generates
  lecture pre-reviews ahead of time (CLAUDE.md's "trigger mechanism").
  Needs a process that stays warm; a serverless function doesn't.

## Running locally (no Docker)

```bash
cp .env.example .env   # fill in WORKER_API_KEY (and ANTHROPIC_API_KEY if you have one)
npm install
npx prisma generate
npm run dev             # http://localhost:4100
```

`web/`'s own `.env.local` needs `WORKER_URL` and a matching `WORKER_API_KEY`.

## Running via Docker

```bash
WORKER_API_KEY=<same key as web/.env.local> docker compose up --build
```

(run from the repo root, where `docker-compose.yml` lives). This starts
Postgres + this worker; `web/` still runs separately (`npm run dev` or a
serverless deploy) pointed at `http://localhost:4100`.

## API

- `POST /files/:namespace` (`lectures` | `syllabi`, bearer auth) — multipart
  upload (`file` field, optional `filename` to control/replace the stored
  name). Returns `{ filename, url }`.
- `GET /files/:namespace/:filename` — public download (no auth — same
  trust model as the unauthenticated static file serving this replaces).
- `GET /files/:namespace/:filename/text` (bearer auth) — extracted plain
  text (PDF/DOCX/text), used by `web/`'s on-demand "Generate preview".

## Known limitation

`prisma/schema.prisma` here is a duplicate of `web/prisma/schema.prisma`,
kept in sync by hand — Docker build contexts don't easily reach outside
their own directory, so a shared schema would need a proper monorepo
workspace. Worth doing if the two ever drift.
