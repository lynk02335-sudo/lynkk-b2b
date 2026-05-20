# Lynkk — Code Review Handoff

This document covers everything that was reviewed, what was changed, and the exact steps needed before this app is production-ready.

---

## What was reviewed

A full end-to-end audit of the Supabase edge functions, React frontend, public tracker script, and code quality. 32 issues were identified and fixed. Phase 2 added funnels, revenue tracking, SMS/push templates, personalization campaigns, and a Twilio webhook — all backed by `workflow-engine/`, a Fastify server that must be deployed separately.

---

## Critical actions before deploying

### 1. Deploy the updated Supabase edge functions

The edge functions have significant bug fixes (wrong column name used everywhere, CORS headers on internal functions, `.single()` errors on empty results, status overwrites, etc.). They **must** be re-deployed or the app will not work correctly.

```bash
supabase functions deploy run-workflows
supabase functions deploy track
supabase functions deploy update-user-status
supabase functions deploy weekly-summary
```

If you don't have the Supabase CLI set up:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

---

### 2. Set Supabase edge function secrets

These must be set in the Supabase dashboard (Project → Edge Functions → Secrets) or via CLI:

```bash
supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxxxx"
supabase secrets set RESEND_FROM_EMAIL="Lynkk <hello@lynkk.ai>"
supabase secrets set APP_URL="https://your-vercel-app.vercel.app"
```

| Secret | What it does | Required? |
|--------|-------------|-----------|
| `RESEND_API_KEY` | **Lynkk's own** Resend API key. Used only for the weekly summary email that Lynkk sends to its customers. | **Yes** — weekly summary won't send without this |
| `RESEND_FROM_EMAIL` | The verified sender address for weekly summary emails (e.g. `Lynkk <hello@lynkk.ai>`). Must be a domain verified in **Lynkk's** Resend account. | **Yes** |
| `APP_URL` | The dashboard URL included in weekly summary emails | **Yes** — links in emails will be broken without this |

**Per-customer email:** Each customer sets their own Resend API key and From Email address in the Settings page. These are stored in the `customers` table and used when their workflows send re-engagement emails to their tracked users.

---

### 3. Set up cron jobs in Supabase

The three background functions need to be scheduled. Go to **Supabase Dashboard → Database → Extensions → pg_cron**, then run these in the SQL editor:

```sql
-- Run workflows every hour
select cron.schedule(
  'run-workflows',
  '0 * * * *',
  $$select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/run-workflows',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);

-- Update user statuses every 6 hours
select cron.schedule(
  'update-user-status',
  '0 */6 * * *',
  $$select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/update-user-status',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);

-- Weekly summary every Monday at 9am UTC
select cron.schedule(
  'weekly-summary',
  '0 9 * * 1',
  $$select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/weekly-summary',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);
```

Replace `<project-ref>` and `<service-role-key>` with your values from Supabase → Project Settings → API.

---

### 4. Pull and redeploy on Vercel

Vercel should auto-deploy on push to `main`. If it doesn't, trigger a manual redeploy from the Vercel dashboard.

Verify these environment variables are set in Vercel (Project → Settings → Environment Variables):

| Variable | Where to find it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `VITE_API_URL` | The public URL of your deployed `workflow-engine` (see step 5) |

Without `VITE_API_URL`, all Phase 2 pages (funnels, SMS/push templates, personalization, revenue analytics) silently fall back to `http://localhost:3001` and fail to load data.

---

### 5. Deploy the workflow-engine backend

`workflow-engine/` is a Fastify server that powers all Phase 2 features. It must be deployed separately from Vercel (Railway, Render, or Fly.io are all suitable).

**Required environment variables for the workflow-engine:**

| Variable | Where to find it |
|----------|-----------------|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role key |

**Deploy steps (Railway example):**
```bash
# From the workflow-engine/ directory
railway login
railway init
railway up
# Then set SUPABASE_URL and SUPABASE_SERVICE_KEY in the Railway dashboard
```

After deploying, copy the public URL and set it as `VITE_API_URL` in Vercel (step 4).

---

## What was fixed (summary)

### Supabase edge functions
- `run-workflows`: All workflow queries used `template_id` — the DB column is `type`. Every query was silently failing and falling through to a no-op default. Fixed.
- `run-workflows`: Was using a shared `RESEND_FROM_EMAIL` env var as the sender, but authenticating with each customer's own Resend key. Resend would reject any send where the from-domain isn't verified in that customer's account. Fixed: re-engagement emails now use `customer.from_email` (their own verified sender) with their own API key.
- `run-workflows`: `.single()` on dedup check logged a PostgREST error on first contact. Switched to `.maybeSingle()`.
- `weekly-summary`: Was also using each customer's Resend key to send a Lynkk platform email — wrong direction entirely. Fixed: weekly summary now uses Lynkk's own `RESEND_API_KEY` + `RESEND_FROM_EMAIL` platform secrets, and sends to all customers regardless of whether they've configured Resend.
- `track`: Every event was setting `status: "active"`, overwriting `at_risk`/`cold` status set by the cron. Removed.
- `track`: Malformed POST body caused an unhandled crash. Wrapped in try/catch.
- `update-user-status`: Both queries lacked idempotency guards — re-wrote already-correct users on every run. Fixed.
- `weekly-summary`: N+1 query loop for comeback detection (100 users = 100 queries). Replaced with single `IN` query.
- `weekly-summary`: Email send was not awaited and errors were silently swallowed. Fixed.
- All internal functions had CORS wildcard headers — removed (only `track` needs them).

### Frontend
- Custom workflows were saved to `localStorage` and lost on browser clear. Migrated to Supabase.
- Template seeding ran on every page load. Fixed with a ref guard and single batch count check.
- Dashboard status badge recomputed status from `last_seen` while metric cards counted from DB `status` — mismatched. Unified to DB status.
- Realtime channel could be orphaned if customer changed twice rapidly. Fixed with `useRef`.
- Hardcoded 5-second auth timeout caused false logout flash on slow connections. Removed.
- Forgot-password countdown leaked multiple intervals on repeated sends. Fixed with shared `useRef`.
- Logout called `localStorage.clear()` — wiped third-party SDK state. Changed to targeted `removeItem`.
- Settings page forced `window.location.reload()` after API key regeneration. Replaced with `refetch()`.
- `sonner` and `shadcn/ui` toast libraries were both active simultaneously. Unified to `useToast`.
- `user.status as UserState` cast without validation. Added `toUserState()` guard. Also fixed `churned` being silently mapped to `cold`.
- Analytics comeback calculation was O(n²) and double-counted users contacted multiple times. Fixed.
- Removed all debug `console.log`/`console.error` from settings, dashboard, workflows, useCustomer, App.

### Tracker script
- Supabase project URL hardcoded. Now reads from `data-url` attribute.
- Events fired before `identify()` were silently dropped. Now queued and flushed on identify.
- 1-second polling for SPA route changes. Replaced with `pushState`/`replaceState`/`popstate` hooks.

### Code quality
- `User` and `Workflow` types defined in three places with diverging shapes. Consolidated to `src/types/database.ts`.
- Status thresholds (48h, 120h) extracted to `src/lib/constants.ts`.
- Dead files deleted: `src/lib/api.ts`, `src/hooks/use-templates.ts`, `src/pages/templates.tsx`.

---

## Known remaining issues

- **Onboarding seeding:** `seedWorkflows()` still runs client-side on first login. It works and is now guarded against duplicate runs, but ideally this moves to a Supabase Auth webhook (`on_auth_user_created`) so it runs server-side exactly once.
- **`workflow-engine` not auto-deployed:** Phase 2 data pages are blank until the workflow-engine is deployed and `VITE_API_URL` is set in Vercel (see step 5 above).
