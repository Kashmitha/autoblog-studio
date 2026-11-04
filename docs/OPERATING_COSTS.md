# Operating costs and profitability

## Initial experiment

Local Node, PostgreSQL, Redis, Next.js, NestJS, Prisma and BullMQ are open source. Running these services on the existing computer requires no new cloud subscription; electricity and internet are existing real costs to record when relevant. Docker Desktop licensing eligibility depends on the owner's use/organization; verify its current terms before business use. No infrastructure was purchased or paid service activated.

Paid AI is disabled. The default monthly ceiling is $3, but no price or account credit is assumed. Set current per-million input/output token rates, a specific available model and explicit billing authorization before enabling. A small model and short source context are suitable starting experiments only after checking the provider's current pricing. Reservations use a conservative upper bound and serialize requests across API instances. Failed or ambiguous requests retain their reservation as a conservative expense estimate until compared with the provider invoice. This is an operating budget guard, not a replacement for provider-side project spending limits.

At 60 articles/month a $3 AI ceiling means an average budget of $0.05 per article, including failed requests and topic generation. Actual cost depends on model prices and token usage. The system stops generating rather than exceeding its configured reservation ceiling. No mandatory stock image subscription: original screenshots/photos and commercially reusable Commons assets are options. Unsplash API availability and account approval must be verified by the owner.

## Dashboard math (USD)

- Actual revenue: only ACTUAL_REVENUE records from owner-verified reports or imports.
- Estimated revenue: ESTIMATED_REVENUE records, displayed separately.
- Expenses: EXPENSE records plus recorded AI usage. Do not enter the same recorded AI cost again as an expense.
- Net profit/loss = actual revenue − expenses. Estimates never improve this number.
- RPM = actual revenue ÷ real pageviews × 1,000. Without pageviews it is unavailable, never fabricated.
- Revenue needed to break even = max(0, expenses − actual revenue).
- Month-over-month revenue change is unavailable without a positive prior actual-revenue baseline.
- Business targets: $10 initial, $10–$30 early experiment, $100 longer term. These are goals, not forecasts or guarantees.

All operating costs and revenue are USD in V1. Convert foreign-currency invoices yourself using a documented actual rate; do not mix LKR numbers into USD records. Record the exchange evidence in the note. Source/date/URL keys and financial report references prevent duplicate imports. Do not mix site totals with individual page rows for the same date/source.

## CSV contracts

Finance columns: `date,kind,category,amount,reference,source,note`. Valid kinds: ACTUAL_REVENUE, ESTIMATED_REVENUE, EXPENSE. Amount must be finite, nonnegative, at most 1,000,000 and up to six decimals. Reference is globally unique. Repeat references skip rather than double count. Dates are YYYY-MM-DD calendar reporting dates.

Traffic columns: `date,url,pageviews,impressions,clicks,source`. Leave unavailable metrics blank, rather than inventing zero. URL is optional for a site-level import; choose either site totals or page-level rows. Repeat date/URL/source imports update the stored row. Clicks cannot exceed impressions when both are provided.

Imports validate the entire file before writing rows. Maximum 1 MB and 1,000 rows. A database outage during the write loop can leave a partial import; retry safely using the same references/keys. Records are never mock earnings. Sample fixtures are restricted to the isolated automated-test database.

## Future spending checkpoint

Before any recurring expense or deployment, document the exact service, current price and billing basis, free alternative, spending limit and cancellation path, then obtain owner approval. Do not assume ChatGPT includes API credits. Hosting is optional until the local experiment justifies it. The system remains useful at zero advertising revenue.
