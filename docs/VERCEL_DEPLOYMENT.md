# Vercel deployment

The first deployment runs the complete product in **demo mode** with no external services: no
database, Redis, payment provider, email, realtime service or storage is required at build or run
time.

## What Vercel detects automatically

| Setting          | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Framework preset | Next.js (auto-detected)                                     |
| Root directory   | `./` (the repository root)                                  |
| Package manager  | pnpm (from `pnpm-lock.yaml`; `packageManager` pins pnpm 10) |
| Install command  | default (`pnpm install`)                                    |
| Build command    | default (`next build`)                                      |
| Output           | default (`.next`)                                           |
| Node.js          | 22.x (`engines.node` is `>=22.12.0`)                        |

No Docker image, custom server or `vercel.json` is needed. The build never connects to a database:
environment validation is lazy and every variable is optional.

## First deployment (demo mode)

1. In Vercel choose **Add New → Project** and import `Imomazin/esocity-bid-platform`.
2. Keep the detected settings above.
3. Environment variables (all optional for the first deploy):

   | Variable              | Value                                                                                              |
   | --------------------- | -------------------------------------------------------------------------------------------------- |
   | `DEMO_MODE`           | `true` (this is also the default)                                                                  |
   | `NEXT_PUBLIC_APP_URL` | The deployment URL, e.g. `https://esocity-bid.vercel.app` (used for canonical and Open Graph URLs) |
   | `ALLOW_INDEXING`      | Leave unset (`robots.txt` then disallows crawling of the demo)                                     |

   Optionally add `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the exact pnpm version pinned in
   `package.json`.

4. **Deploy.** Preview deployments are created for every branch and pull request; merge to `main`
   for production.

## Verify the deployment

```bash
curl https://<deployment>/api/health
# {"status":"ok","version":"0.1.0","environment":"production","mode":"demo",
#  "services":{"database":"not-required (demo)","payments":"demo (simulated)", ...}}
```

With no integrations, check that a visitor can:

- see the landing page, browse Discover, the Marketplace and categories, search, and open a product;
- open a live auction with a realistic countdown and see simulated bidders;
- enter the demo, receive a demo Bid Wallet, bid and see the wallet deduction;
- set up AutoBid, watch an auction, browse Flash Drops, use Buy Now;
- complete a demo checkout and see the order, rewards and account pages;
- open `/admin` and see realistic operational analytics.

The Playwright suite automates these journeys against any URL:

```bash
E2E_BASE_URL=https://<deployment> pnpm test:e2e
```

## Demo-mode behaviour on serverless

- The demo world is **deterministic from wall-clock time**, so every instance shows the same
  auctions, prices and history.
- **Member sessions live in the memory of the instance that created them** and reset when that
  instance is recycled. Occasional resets are expected in demo mode; the member simply enters the
  demo again. Persistent sessions arrive with PostgreSQL in Phase 2.
- No background jobs are needed: each request advances the world to the current time.

## Integration sequence

Switch services on one at a time, verifying `/api/health` and the e2e suite after each step.

| Step | Service                                           | What to set                                                                                                   | Notes                                                                                                                                                   |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Vercel**                                        | Project, domains, `NEXT_PUBLIC_APP_URL`                                                                       | Demo mode, as above.                                                                                                                                    |
| 2    | **PostgreSQL** (Neon, Vercel Postgres or similar) | `DATABASE_URL`                                                                                                | Run `pnpm db:migrate` then `pnpm db:seed` from CI or locally against the new database. Keep `DEMO_MODE=true` until Phase 2 wiring switches the backend. |
| 3    | **Upstash Redis**                                 | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                          | Rate limits, idempotency keys and locks become shared across instances immediately.                                                                     |
| 4    | **Authentication** (Auth.js or Clerk)             | `AUTH_SECRET` (+ provider keys)                                                                               | Implement `getProductionViewer` / `getProductionAdmin`; enforce MFA for staff.                                                                          |
| 5    | **Stripe** (sandbox first)                        | `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Hosted checkout only; register the webhook endpoint.                                                                                                    |
| 6    | **Realtime** (Ably)                               | `REALTIME_PROVIDER=ably`, `ABLY_API_KEY`                                                                      | The CSP allows Ably hosts automatically.                                                                                                                |
| 7    | **Email** (Resend)                                | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`                                                       | Verify the sending domain.                                                                                                                              |
| 8    | **Object storage** (Vercel Blob or S3)            | `STORAGE_PROVIDER` (+ credentials)                                                                            | Real product photography replaces generated artwork per product.                                                                                        |
| 9    | **Shipping APIs** (multi-carrier)                 | Provider keys                                                                                                 | Labels, rates and tracking webhooks.                                                                                                                    |

After step 2 and the Phase 2 backend wiring, set `DEMO_MODE=false`. From then on `/api/health`
reports any required variable that is missing (by name only) and the demo is no longer served.

## Scheduled work (from Phase 2)

Auction start and finalisation run from a scheduled route (Vercel Cron) or a queue worker calling
`startDueAuctions()` and `finalizeDueAuctions()`; both are idempotent and safe to run concurrently.

## Security reminders

- Store every secret in Vercel environment variables, never in the repository. `pnpm secret-scan`
  runs in CI on every push.
- Use separate keys for Preview and Production environments; Stripe keys in Preview must be test
  keys.
- Set `ALLOW_INDEXING=true` only on the production domain when ready to launch.
