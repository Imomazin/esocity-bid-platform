# Compliance

> **This document identifies areas that require legal and regulatory review before a production
> launch. It does not contain legal advice or conclusions, and none are encoded in the software.**
> The platform provides configuration switches and hooks so that the outcome of that review can be
> applied per market without code changes.

Pay-to-bid auction mechanics (where participants pay for each bid, and the final price is usually
far below the item's value) may be treated differently from conventional auctions, retail sales,
prize promotions or gambling, and that treatment can differ between jurisdictions. Esocity should
obtain advice from qualified counsel in each launch market before enabling paid bidding with real
money.

## Configuration and hooks

| Concern                                 | Where it is configured                                                                                                                       | Current setting                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Paid bidding per market                 | `paidBiddingEnabled` in `src/lib/config/market.ts`; `auctions` feature flag per market in `src/lib/config/flags.ts`                          | UK on (for the demonstration); IE and US **off** pending review                                              |
| Buy Now bid recovery per market         | `buyNowRecoveryEnabled`, `buyNowRecovery` flag                                                                                               | UK on (demonstration); IE and US off                                                                         |
| Age eligibility                         | `minimumAge` per market and per auction (`eligibility.minimumAge`); `users.age_verified_at`                                                  | 18+ everywhere; age confirmation required before bidding or buying bids                                      |
| Jurisdiction eligibility                | `eligibility.markets` per auction; member `market`                                                                                           | UK only                                                                                                      |
| Terms acceptance                        | `compliance.termsVersion` and `termsRequiredFor` per market; `users.terms_accepted_version` / `terms_accepted_at`; `POST /api/account/terms` | Current terms required to bid, buy bids and check out; bumping the version asks every member to accept again |
| Identity verification (KYC) placeholder | `compliance.kycRequiredFor` per market; `users.kyc_status`                                                                                   | Not required in any market; enforced automatically if a market's policy lists actions                        |
| Promotion restrictions                  | Promotion eligibility (new customers, tiers, categories, packs, usage caps) in `src/domain/promotions.ts`                                    | Configured per promotion                                                                                     |
| Spending controls                       | Responsible-use limits (`src/domain/responsible-use.ts`), monthly bid budget, cool-off                                                       | Enabled for every member                                                                                     |
| Feature flags                           | `FEATURE_FLAGS` environment variable and runtime overrides                                                                                   | See `.env.example`                                                                                           |

The compliance gate (`src/domain/compliance.ts`) runs on the server for bids (both engines), bid
pack purchases and checkout, and returns a clear message rather than a legal explanation.

## Areas requiring legal review (UK launch)

The following questions are raised for counsel. They are prompts, not conclusions.

### Product classification

- How pay-to-bid auctions, the Bid Credit system and Buy Now recovery are characterised under
  gambling, lottery and prize-competition legislation (e.g. the Gambling Act 2005 framework), and
  whether any format (reserve auctions, minimum-participant rules, hard stops, AutoBid, promotional
  bids) changes that analysis.
- Whether auction formats should be adjusted (for example always offering Buy Now with recovery)
  and what disclosures are needed.

### Consumer protection and fairness

- Unfair commercial practices rules (now in the Digital Markets, Competition and Consumers Act 2024)
  as they apply to: countdown timers and timer extensions, urgency and scarcity messaging,
  "savings" and reference-value claims, statements about winning, and total-cost disclosure (bids
  spent plus final price).
- Reference pricing: how "reference value" and savings figures must be sourced and substantiated.
- Advertising codes (CAP Code / ASA) for auction and bid-pack marketing, including past rulings on
  penny-auction advertising.
- Consumer Rights Act 2015 fairness of terms, including bid-credit expiry (promotional credits
  expire; purchased credits currently never expire), refunds and account closure.
- The Consumer Contracts Regulations 2013: cancellation rights for bid packs (digital content or
  service), for auction wins and for Buy Now purchases, and any auction-related exceptions.
- AutoBid disclosures and fairness between AutoBid users and manual bidders.

### Demonstration safeguards

- **Simulated bidders must never run in production.** The demo world uses anonymised simulated
  bidders that are always labelled as simulated; production must use real participants only.
  Counsel should confirm the controls and disclosures for any house or promotional activity.
- Demo reference values, savings and win examples are demonstration data and must not be presented
  as real commercial results.

### Payments, tax and financial crime

- VAT treatment of bid packs (for example as vouchers) and of auction sales at a price below the
  reference value.
- Whether bid credits, which are non-withdrawable and have no cash value, create any e-money or
  payment-services considerations.
- Anti-money-laundering and fraud expectations, including whether identity verification (KYC) is
  needed above certain spend levels — the KYC hook exists for this.
- Strong Customer Authentication is handled by the payment provider's hosted checkout.

### Data protection and privacy

- UK GDPR and PECR: lawful bases, marketing consent, cookies and similar technologies, retention of
  bidding, risk and audit data, and data-subject rights.
- Automated decision-making: risk scoring recommends actions but blocks are human decisions; confirm
  the notices and review rights required.
- International transfers for any third-party processors (payments, email, realtime, analytics).

### Responsible use

- Whether additional safeguards are expected (for example default limits, reality checks, spend
  summaries, self-exclusion across related products, or signposting) and how they are evidenced.

### Accessibility

- Equality Act 2010 duties: the customer experience targets WCAG 2.2 AA; confirm the audit and
  remediation process before launch.

## Other markets

IE and US are configured as **placeholder markets with paid bidding, AutoBid and recovery
disabled**. In the United States treatment can vary by state. Each market needs its own review
before these switches are changed.

## Launch checklist

- [ ] Legal opinion on product classification in each launch market.
- [ ] Final terms of use, auction rules and privacy notice approved; `TERMS_VERSION` bumped.
- [ ] Marketing, reference-price and savings claims reviewed.
- [ ] Simulated bidders and demo data disabled (`DEMO_MODE=false`) and verified absent.
- [ ] Responsible-use defaults approved.
- [ ] Payment, VAT and financial-crime controls agreed with finance and the payment provider.
- [ ] Data protection impact assessment completed.
- [ ] Accessibility audit completed.
- [ ] Complaints handling and escalation route published.
