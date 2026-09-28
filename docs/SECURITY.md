# Security

This repository is **public**. Security rests on three commitments: no secrets in the codebase,
every sensitive decision made and validated on the server, and defence in depth so a single
mistake cannot corrupt money, credits, stock or auction outcomes.

## Threat model (summary)

| Threat                                                                                    | Primary controls                                                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Manipulating auction outcomes (bidding after the close, forging prices, choosing winners) | Server-authoritative engine, DB clock, row locks, SYSTEM-only finalisation, `CHECK` constraints, append-only bids and results |
| Double-spending credits or double-charging (double clicks, retries, races)                | Idempotency keys, per-auction and per-wallet serialisation, unique keys, non-negative balance constraints                     |
| Cross-site request forgery                                                                | Same-origin check on every mutating API call, `SameSite=Lax` cookies                                                          |
| Cross-site scripting                                                                      | React escaping, nonce-based CSP with `strict-dynamic`, no inline scripts without a nonce                                      |
| Clickjacking                                                                              | `X-Frame-Options: DENY`, `frame-ancestors 'none'`                                                                             |
| Privilege escalation in operations tools                                                  | RBAC checked server-side on every admin page and API route; demo roles cannot grant customer-to-staff access                  |
| Bots and abuse                                                                            | Rate limits per action, fraud signals, human-reviewed decisions                                                               |
| Secret leakage                                                                            | Environment variables only, lazy server-only validation, redacting logger, secret scan in CI                                  |
| Card data exposure                                                                        | Hosted checkout only — card data never reaches Esocity servers                                                                |
| Information disclosure through errors                                                     | Stable error codes and friendly messages; stack traces never returned                                                         |

## Secrets and configuration

- All configuration comes from environment variables. `.env.example` documents every variable
  with **empty** values; `.env*` files other than the example are git-ignored.
- `src/lib/config/env.ts` validates variables lazily on first use, on the server only
  (`server-only` import). Nothing is read at build time, and invalid values fall back to safe demo
  defaults while `/api/health` reports the problem **by variable name only**.
- Only `NEXT_PUBLIC_*` variables reach the browser bundle; none of them are secrets.
- `pnpm secret-scan` (`scripts/secret-scan.mjs`) fails CI if a file contains something that looks
  like a private key, Stripe/AWS/GitHub/Slack/Google/Resend credential, JWT, a connection string
  with an embedded password or a secret assignment in an env-style file — and if a `.env` file is
  committed. It reports file and line only, never the value.
- Local services (`docker-compose.yml`) and CI databases use passwordless trust authentication on
  loopback or throwaway containers, so no credential exists to leak.
- If a secret is ever committed: rotate it immediately, then remove it from history.

## HTTP hardening

| Header                       | Value                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | Per-request nonce (`src/proxy.ts`): `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `connect-src` limited to self (plus the realtime provider when configured); `upgrade-insecure-requests` on Vercel |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`                                                                                                                                                                                                                                                                      |
| `X-Frame-Options`            | `DENY`                                                                                                                                                                                                                                                                                                              |
| `X-Content-Type-Options`     | `nosniff`                                                                                                                                                                                                                                                                                                           |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                                   |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                                                                                                                                                                                                                                                                       |
| `Permissions-Policy`         | camera, microphone, geolocation, USB and FLoC disabled; payment limited to self                                                                                                                                                                                                                                     |
| `X-Powered-By`               | removed                                                                                                                                                                                                                                                                                                             |
| API responses                | `Cache-Control: no-store`, `X-Robots-Tag: noindex`                                                                                                                                                                                                                                                                  |
| Admin pages                  | `X-Robots-Tag: noindex, nofollow`; `robots.txt` disallows everything unless `ALLOW_INDEXING=true`                                                                                                                                                                                                                   |

## Every API route goes through `route()`

`src/server/http/api.ts` gives each route, in order:

1. a request id (propagated from the proxy or generated) returned as `x-request-id`;
2. **CSRF protection** for `POST/PUT/PATCH/DELETE`: requests with `Sec-Fetch-Site: cross-site` or
   an `Origin` that does not match the host are rejected (`CSRF_REJECTED`);
3. **authentication** (`none`, `optional`, `customer` or `admin`) and an **RBAC permission** check
   for admin routes;
4. **rate limiting** with standard `RateLimit-*` and `Retry-After` headers;
5. **Zod validation** of JSON bodies and query strings, with field-level error details;
6. **idempotency** for critical commerce actions (`Idempotency-Key` required): bids, checkout,
   bid-pack purchases, drop purchases, reward redemptions, refunds and wallet adjustments. Replays
   return the original result; the same key with a different payload is rejected;
7. **error mapping**: domain errors become stable codes and HTTP statuses; anything unexpected is
   logged with the request id and returned as a generic `INTERNAL` message.

These behaviours are covered by `tests/unit/api-route.test.ts` and the e2e security checks.

## Rate limits

| Policy                                         | Limit                        |
| ---------------------------------------------- | ---------------------------- |
| Bid burst / sustained                          | 4 per second / 90 per minute |
| AutoBid changes                                | 20 per minute                |
| Checkout / bid-pack purchases / drop purchases | 10 / 6 / 10 per minute       |
| Promotion code checks                          | 20 per 10 minutes            |
| Support tickets                                | 5 per hour                   |
| Demo session creation                          | 30 per hour per IP           |
| Other mutations / admin mutations / reads      | 120 / 60 / 600 per minute    |

Limits are keyed by staff id, member id or IP address. Memory-based in demo; a Redis sliding window
(atomic Lua script) when Upstash is configured, so limits hold across serverless instances.

## Authentication and sessions

- **Demo mode:** "Enter demo" issues a random UUID session id in an `httpOnly`, `SameSite=Lax`,
  `Secure` (in production) cookie that maps to a sandboxed demo account. Session ids are validated
  as UUIDs before use. The operations console runs as a simulated operator whose role can be
  switched to explore permissions; a customer role can never be selected as a staff role.
- **Production (Phase 3):** `getProductionViewer()` and `getProductionAdmin()` in
  `src/server/auth/session.ts` are the attach points for Auth.js or Clerk. Requirements: MFA for
  staff, short admin session lifetimes, role assignment only by Super Admins, `AUTH_SECRET` of at
  least 32 random characters.

## Authorisation (RBAC)

Roles: `CUSTOMER`, `SUPPORT_AGENT`, `OPERATIONS`, `MERCHANDISER`, `FINANCE`, `ADMIN`,
`SUPER_ADMIN`. Permissions are fine-grained (`auctions.manage`, `auctions.cancel`,
`autobid.killswitch`, `refunds.issue`, `wallet.adjust`, `fraud.decide`, `fraud.block`,
`audit.view`, …) and mapped per role in `src/server/auth/roles.ts`. Every admin page calls
`adminAccess(permission)` before reading data, and every admin API route declares its permission —
hiding a navigation item is never the only protection. Notable separations:

- Only **Super Admin** can adjust wallets or block accounts.
- **Finance** issues refunds but cannot change auctions; **Merchandisers** manage catalogue and
  promotions but cannot refund; **Support agents** can view orders, customers and auctions and
  handle tickets, but cannot move money, credits or auctions.
- Nobody can choose or change an auction winner.

## Data integrity

- Money in integer minor units; no floating point in settlement.
- Ledgers are append-only; triggers reject `UPDATE`, `DELETE` and `TRUNCATE`
  ([DATA_MODEL.md](./DATA_MODEL.md)).
- All SQL goes through Drizzle's parameterised queries; raw SQL is limited to static statements
  (reading the database clock) and the test-database reset.

## Logging and audit

- Structured JSON logs with a redacting logger: keys resembling passwords, secrets, tokens,
  authorisation, cookies, API keys, card data, IBANs, sessions or signatures are replaced with
  `[redacted]`; errors are reduced to name and message.
- Every staff action and every automated decision with customer impact (auction transitions, rule
  changes, refunds, wallet adjustments, fraud decisions, the AutoBid kill switch) is written to
  the audit log with actor, role, request id, severity and summary. In PostgreSQL `audit_events`
  is append-only.

## Payments

Hosted checkout only; webhook signatures verified with a constant-time HMAC comparison and a
five-minute replay window; provider events de-duplicated. See [PAYMENTS.md](./PAYMENTS.md).

## Supply chain

Dependencies are pinned to exact versions with a committed lockfile; CI installs with
`--frozen-lockfile`. Run `pnpm audit` and review updates before merging dependency bumps.

## Reporting a vulnerability

Please report security issues privately to the Esocity engineering team (AX / Ambidexters) rather
than opening a public issue. Include steps to reproduce and the affected route or component.
