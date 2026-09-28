# CLAUDE.md — Esocity Bid

**Product:** Esocity Bid
**Position:** The Intelligent Live Marketplace — "Live Commerce. Smarter Bidding."
**Client:** Esocity · **Engineering partner:** AX / Ambidexters

Esocity Bid combines live auctions, a fixed-price marketplace, Flash Drops, Buy Now, rewards,
personalisation, responsible-use controls, operations tooling and fraud intelligence in one
Next.js application. Read [README.md](./README.md) for the tour and [docs/](./docs) for the design.

## Non-negotiable rules

1. **The server is authoritative for auctions.** Bid acceptance, price, the clock and the winner
   are decided on the server (`src/domain/auction/bidding.ts`, run inside a lock or row-locked
   transaction). The browser only submits an intent to bid.
2. **Never determine a winner client-side.** Countdowns in the browser are display-only and are
   derived from server time (`src/lib/client/clock.ts`). Only the SYSTEM actor can move an auction
   to FINALIZING/COMPLETED (`src/domain/auction/state-machine.ts`).
3. **A bid balance can never go negative.** Debits go through `planDebit` and the PostgreSQL
   `CHECK` constraints; `INSUFFICIENT_CREDITS` is the only outcome of an overdraw attempt.
4. **No critical mutable balance without a ledger.** Bid credits, reward points, inventory and
   money movements are append-only event logs. Cached projections (`bid_wallets`,
   `inventory_positions`) must always reconcile. Corrections are new compensating entries — never
   UPDATE/DELETE on ledger tables (triggers reject it).
5. **No floating point for money.** Integer minor units (`src/lib/money.ts`), basis points for
   percentages, explicit rounding in BigInt. Floats only when formatting for display.
6. **Every sensitive action is validated on the server:** Zod schemas, authentication, RBAC
   permission (`src/server/auth/roles.ts`), same-origin check, rate limit and — for money or
   credit movements — an `Idempotency-Key`. Use the `route()` wrapper in `src/server/http/api.ts`
   for every API route and `adminAccess()` in every admin page.
7. **No secrets, ever.** The repository is public. No API keys, Stripe keys, database
   credentials, Redis secrets, auth secrets, tokens or passwords in code, tests, docs, fixtures or
   commits. Configuration comes from environment variables (`.env.example` holds empty
   placeholders). `pnpm secret-scan` must pass. Never log secrets, cookies or card data.
8. **Never collect raw card details.** Payments go through the provider's hosted checkout; the
   demo provider simulates outcomes with no card data at all.
9. **Original work only.** Do not copy DealDash (or any competitor's) code, visual design,
   copy, imagery, branding or interface elements. Product artwork is generated
   (`src/components/product/product-art.tsx`); do not add copyrighted product imagery.
10. **Demo mode must always remain deployable.** `DEMO_MODE=true` with no other variables must
    build and run the entire product on Vercel. Never make an integration mandatory at build time.
11. **Paid-bid mechanics require compliance review by jurisdiction.** Market switches live in
    `src/lib/config/market.ts` and `src/lib/config/flags.ts`; IE/US stay disabled pending legal
    review. Do not encode legal conclusions in code — see `docs/COMPLIANCE.md`.
12. **Transparent auction mechanics.** Costs, increments, timer extensions, reserve/minimum
    participant rules, refunds and recovery must be stated plainly wherever a member can bid.
    Simulated bidders and demo data are always labelled as simulated.
13. **Responsible use is enforced server-side.** Lowering a limit applies immediately; raising or
    removing one waits 24 hours; a cool-off can be extended but never shortened. Never build a
    mechanism that bypasses member limits. Rewards never incentivise buying or spending bids.
14. **Fraud tooling produces risk indicators, not accusations.** Automation may throttle; blocking
    needs a recorded human decision. Customer-facing copy never implies wrongdoing.
15. **Never expose stack traces or internals to customers.** Errors map to stable codes and
    friendly messages (`src/server/http/errors.ts`).
16. **Production changes require tests.** Domain rules get unit tests; concurrency-sensitive code
    gets concurrency tests; the PostgreSQL engine is covered by `tests/db`.
17. **Before every commit:** `pnpm secret-scan && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
    (`pnpm validate` runs them all). Run `pnpm test:db` when touching `db/` or `src/server/postgres/`
    and `pnpm test:e2e` when touching user journeys.
18. **Preserve Vercel compatibility:** no localhost production dependencies, no filesystem state,
    no database connection at build time, Node.js runtime for server code.
19. **Clean feature branches and PRs.** Never push directly to `main`; one focused branch per
    change; describe what changed, how it was validated and what is out of scope.

## Where things live

| Path                                  | What                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`                         | Pure business rules shared by every backend (auctions, wallet ledger, inventory, orders, promotions, rewards, responsible use, fraud, drops). No I/O. |
| `src/server/demo/`                    | In-memory demo backend: deterministic world, simulated bidders, series scheduler.                                                                     |
| `src/server/postgres/`                | Production auction engine on PostgreSQL (row locks, DB clock, ledger writes).                                                                         |
| `src/server/http/`                    | `route()` wrapper, error mapping, Zod request schemas.                                                                                                |
| `src/server/infra/`                   | Rate limiting, idempotency, locks, audit log, logger (memory + Redis implementations).                                                                |
| `src/server/providers/`               | Ports and adapters: payments, email, realtime, shipping, storage, analytics, search, recommendations.                                                 |
| `src/server/auth/`                    | Session, RBAC roles/permissions, `adminAccess()`.                                                                                                     |
| `src/app/(site)/`                     | Customer pages. `src/app/admin/` operations console. `src/app/api/` typed API routes.                                                                 |
| `db/`                                 | Drizzle schema, SQL migrations (incl. append-only triggers) and the idempotent seed.                                                                  |
| `tests/unit`, `tests/db`, `tests/e2e` | Vitest unit/concurrency, PostgreSQL integration, Playwright journeys.                                                                                 |

## Conventions

- Next.js 16 App Router: `params`/`searchParams` are promises, the network boundary is
  `src/proxy.ts`, error boundaries receive `retry`. Run `pnpm exec next typegen` after adding
  routes so `PageProps<'/route'>` types exist. Read `node_modules/next/dist/docs/` before using an
  unfamiliar API.
- React 19 hook rules are enforced by lint: no synchronous `setState` in effects.
- Server-render by default; client components only for interactivity. Timers subscribe to one
  shared server clock rather than re-rendering pages.
- Format values with `src/lib/format.ts` / `src/lib/money.ts` (deterministic, en-GB, GBP) so
  server and browser output match.
- SVG `id`s must be unique per instance (`useId`), because `url(#id)` resolves document-wide.
- Demo runtime state lives on `globalThis` and survives hot reload: restart `pnpm dev` after
  changing backend code.
- Keep domain functions pure and deterministic; pass `now` in rather than reading the clock.

@AGENTS.md
