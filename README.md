# Lynkk B2B — Customer Engagement Platform

Monorepo with Vite frontend + Fastify workflow-engine backend.

## Structure

```
├── frontend/           # Vite + React + Tailwind + shadcn/ui
│   ├── public/         # Static assets + tracker scripts
│   ├── src/            # Frontend source code
│   ├── vercel.json     # Vercel deployment config
│   └── package.json
│
├── backend/
│   ├── workflow-engine/ # Fastify API server with BullMQ + Prisma
│   ├── functions/       # Supabase Edge Functions
│   ├── supabase/        # Supabase migrations
│   ├── Dockerfile       # Google Cloud Run deployment
│   └── package.json
│
├── package.json         # Root workspace scripts
└── start-dev.sh         # Local dev launcher
```

## Quick Start

```bash
npm run install:all      # Install all dependencies
npm run dev              # Start frontend + backend concurrently
npm run dev:frontend     # Frontend only (Vite on :5173)
npm run dev:backend      # Backend only (Fastify on :3001)
```

## Deployment

- **Frontend** → Vercel (root: `frontend/`)
- **Backend** → Google Cloud Run (build `backend/Dockerfile`)
- **Supabase Edge Functions** → `supabase functions deploy`
- **Database** → Supabase Postgres + Prisma migrations

## Environment Variables

Copy `.env.example` files and fill in:

| File | Required |
|------|----------|
| `frontend/.env` | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL |
| `backend/workflow-engine/.env` | SUPABASE_URL, SUPABASE_SERVICE_KEY, PORT |
