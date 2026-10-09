# Public API v1 (mobile app)

Base path: `/api/v1`. JSON in and out, no account and no token: a customer is
identified only by the phone number and order reference they give. Everything
the website's Server Actions already enforce (prices from the database, stock,
promo codes, payment-proof checks, rate limits, boutique licenses) applies here
too — the order and tracking routes call those same actions.

**OpenAPI.** The machine-readable description is `docs/openapi.json`
(OpenAPI 3.1), served by every deployment at `GET /api/v1/openapi.json` with
the server URL set to that deployment. Generate the app's types from it
(`npx openapi-typescript https://<host>/api/v1/openapi.json -o src/api/schema.ts`).
A test fails if a route under `app/api/v1` is missing from it; when a field is
added, update both this page and the spec.

**Stability.** Installed apps don't update themselves, so v1 only grows: new
fields and routes may appear, existing ones never change meaning or disappear.
A breaking change means `/api/v2`, with v1 kept while old app versions circulate.

## Conventions
- `?locale=fr|en|ar` on boutique routes picks the language of boutique texts
  (default `fr`). Product and category names have a single language.
- Errors are `{ "error": "<code>" }`. Codes and statuses: `invalid` 400,
  `invalidFile` 400, `fileTooLarge` 413, `notFound` 404, `storefrontExpired`
  403 (the boutique's license is suspended, expired or cancelled),
  `rateLimited` 429, `insufficientStock` 409, `alreadyUsed` 409,
  `referenceCollision` 409, `transactionAlreadyUsed` 409,
  `appUpdateRequired` 426, `uploadFailed` 502; any other business error 422.
- Catalogue `GET`s may be cached for 30 s; everything else is `no-store`.
- Money amounts are numbers in the boutique's currency (MRU).

## Request headers (all routes)
Optional, sent by the app on every call:

| Header | Example | Use |
|---|---|---|
| `X-Request-Id` | a UUID per call | Echoed back in the response's `X-Request-Id` and logged; one is generated when missing (or not 1–128 of `A-Z a-z 0-9 _ . : -`) |
| `X-App-Version` | `1.4.0` | Logged; compared with the minimum version below |
| `X-App-Platform` | `ios` / `android` | Logged |

Every response carries `X-Request-Id`.

**Minimum app version.** When the server sets `APP_MIN_VERSION` (unset by
default), an app sending an older `X-App-Version` gets
`426 { "error": "appUpdateRequired" }` on every route. An app that sends no
version is never blocked.

**Mobile side:** send the three headers on every call; show the response's
`X-Request-Id` in error screens / bug reports; on `426 appUpdateRequired`, show
an "update the app" screen with a link to the store.

## Rate limits
Counted per IP address and, where the body carries one, per phone number
(a sliding window; the website shares the same counters).

| Route | Per phone | Per IP |
|---|---|---|
| `POST .../orders` | 5 / hour (`customerPhone`) | 20 / hour |
| `POST .../orders/track` | 10 / 15 min | 30 / 15 min |
| `POST .../promo` | 10 / 15 min (`customerPhone`) | 20 / 15 min |
| `POST` / `DELETE .../orders/push` | — | 20 / hour |

Over a limit: `429 { "error": "rateLimited" }` with a `Retry-After` header
(seconds). A resend carrying an already-used `Idempotency-Key` is never
counted.

**Mobile side:** on a 429, show "try again in n minutes" from `Retry-After`
and don't retry automatically before it.

## Routes
| Route | Purpose |
|---|---|
| `GET /boutiques` | Boutiques the customer can pick (closed ones are left out) |
| `GET /boutiques/{key}` | Branding, theme, payment details and wallets, social links, categories |
| `GET /boutiques/{key}/products?category=&q=&page=&pageSize=` | Catalogue page (`pageSize` ≤ 50, default 20) or search (`q`, rate-limited, one capped page) |
| `GET /boutiques/{key}/products/{slug}` | Product with images and variants (id, size, color, price, stock, lowStockThreshold) |
| `POST /boutiques/{key}/stocks` `{ variantIds }` | Fresh stock for a saved cart: `{ stocks: { id: n } }`. A missing id no longer exists |
| `POST /boutiques/{key}/promo` `{ code, customerPhone, subtotal }` | Preview a promo code: `{ discountType, discountValue, discount }`. Not consumed until the order |
| `POST /boutiques/{key}/orders` (multipart) | Place an order → `201 { reference, orderId }` |
| `POST /boutiques/{key}/orders/track` `{ phone, reference }` | `{ reference, status, total, createdAt, statusSince }` |
| `POST` / `DELETE /boutiques/{key}/orders/push` `{ phone, reference, token }` | Start / stop push notifications for one order (see below) |

### Wallets
`payment.wallets` is `[{ id, provider, providerKey, number, logoUrl }]`, in the
order the admin set. The admin can add, edit (name, number, logo), re-order and
delete wallets at any time, so the app shows the list as received on each
boutique refresh and keys it by `id` (stable across edits).

- `providerKey`: `bankily`, `masrivi`, `sedad`, `bimbank` for a provider the
  site knows (more may be added later), `null` for any other.
- `logoUrl`: for a known provider, the site's bundled logo
  (`https://<host>/wallets/<key>.svg`); otherwise the logo the admin uploaded
  (Supabase, public PNG/JPEG/WebP), or `null` when there is none.

**Mobile side:** draw the logo of a `providerKey` the app knows itself; else load
`logoUrl` (an SVG for the site's bundled logos); else, or if loading fails, show
the provider's initials.

### Products
Every product (catalogue, search and product page) carries:
- `colors`: the distinct variant colors, in the order the admin entered them.
  Exact strings, as on the variants and images (`"Noir"` and `"noir"` are two colors).
- `colorsInStock`: the subset with at least one variant in stock.
- `colorSwatches`: `[{ name, hex, hexes }]`, one per entry of `colors`, from the
  website's swatch table. `hexes` has one hex per hyphen segment
  (`"Noir-Blanc"` → `["#18181b", "#ffffff"]`), `null` for a name the table
  doesn't know; `hex` is the first one.

On the product page, `variants` come in size order: letter sizes XXS…XXXL
(`2XL`/`3XL` accepted), then numeric sizes by value (`38`, `40,5`, `42`), then
anything else (`TU`, `6 ans`…) in entry order; equal sizes keep entry order.
Each variant's `lowStockThreshold` is the stock at or under which the website
shows "only n left".

```json
{
  "id": "cm…", "slug": "t-shirt", "name": "T-shirt",
  "category": { "id": "cm…", "name": "Vêtements" },
  "imageUrl": "https://…/product-images/p/a.jpg",
  "price": { "min": 1000, "max": 1200 }, "compareAtPrice": 1500,
  "isFeatured": true, "inStock": true,
  "colors": ["Noir", "Noir-Blanc"],
  "colorsInStock": ["Noir"],
  "colorSwatches": [
    { "name": "Noir", "hex": "#18181b", "hexes": ["#18181b"] },
    { "name": "Noir-Blanc", "hex": "#18181b", "hexes": ["#18181b", "#ffffff"] }
  ]
}
```

### Placing an order
`multipart/form-data` fields: `customerName`, `customerPhone` (8 digits,
starts with 2, 3 or 4), `customerCity`, `paymentSenderPhone` (same format),
`locale` (`fr|en|ar`, language of the messages sent about the order), `items`
(JSON string `[{"variantId":"…","quantity":1}]`), `promoCode` (optional),
`paymentTransactionId` (optional, see below), `screenshot` (the payment
proof, PNG/JPEG/WebP). The boutique is the one in the
URL; a `productType` field in the body is overridden.

```sh
curl -X POST https://<host>/api/v1/boutiques/sport/orders \
  -F customerName="Aïcha" -F customerPhone=37737353 -F customerCity=Nouakchott \
  -F paymentSenderPhone=37737353 -F locale=fr \
  -F 'items=[{"variantId":"<id>","quantity":1}]' \
  -F screenshot=@proof.png
```

### Pending orders
- **Stock is reserved as soon as the order is placed** (status `PENDING`), not
  at confirmation. It is given back when the order is rejected or cancelled,
  and so is the promo code redemption.
- A boutique can have unvalidated orders cancelled on their own after 24, 48,
  72 or 168 hours (superadmin setting; **off by default**). The check runs once
  a day (Vercel Cron, 06:00 UTC), so an order can stay up to a day past the
  delay. The order becomes `CANCELLED` with the reason `payment_timeout`, stock
  and promo code are given back, and registered phones get the usual
  "cancelled" push. Tracking then answers `status: "CANCELLED"`.

**Mobile side:** nothing new to send. Treat `CANCELLED` on a never-confirmed
order as "not validated in time": invite the customer to order again or
contact the boutique.

### Order references
New orders get `CMD-` followed by 8 random characters from
`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no 0/O, no 1/I), e.g. `CMD-7KQ4M9XP`.
Older references (`CMD-20261005-1234`) stay valid everywhere. Lookups are
case-insensitive.

**Mobile side:** don't validate the reference format; accept anything non-empty
and upper-case it for display.

### Payment checks
- `paymentTransactionId` (optional, ≤ 64 characters): the transaction id the
  wallet (Bankily, Masrivi…) shows after the transfer. Stored trimmed and
  upper-cased (`" bk12ab34 "` → `"BK12AB34"`). If another order of the same
  boutique that isn't rejected or cancelled already carries it →
  `409 { "error": "transactionAlreadyUsed" }`. Blank or missing: no check
  (the website doesn't ask for it). Over 64 characters → `400 invalid`.
- The screenshot's SHA-256 is recorded. The same image on another order of
  the boutique doesn't refuse the order: the admin's order page warns
  "Screenshot already used for CMD-…".

**Mobile side:** add an optional "Transaction ID" field to the payment step and
send it as `paymentTransactionId`. On `transactionAlreadyUsed`, tell the
customer this transaction is already attached to an order and let them correct
the id (keep the rest of the form).

### Resending an order (Idempotency-Key)
A lost connection or a double tap can send the same order twice. Send an
`Idempotency-Key` header on `POST .../orders`: any string of 1–64 printable
ASCII characters (a UUID is fine), generated once per order and **the same on
every resend** of that order.

- A resend with a key already used in this boutique answers the first
  `201 { reference, orderId }` again: no second order, no stock or promo code
  taken twice. It is answered even if the body differs or the rate limit is
  reached. Keys are remembered as long as the order exists (at least 24 h).
- Two sends running at the same time still make one order (unique key per
  boutique in the database); both get the same `201`.
- The same key in another boutique is a different order.
- A malformed key (empty, over 64 characters, spaces or non-ASCII) → `400 invalid`.
- No header: unchanged behaviour (each send is a new order). The website
  doesn't send one.

**Mobile side:** create the key when the customer taps "Order" (not per HTTP
attempt), keep it with the pending order until a `201` arrives, and reuse it
for every retry.

## Push notifications
There are no accounts, so a device token hangs off an **order**, proven with the
same phone + reference as tracking.

1. After placing an order, the app asks the user for notification permission and
   gets its Expo token (`ExponentPushToken[...]`).
2. It calls `POST /boutiques/{key}/orders/push` with `{ phone, reference, token }`
   (`DELETE` with the same body to stop). Up to 5 devices per order; the oldest
   is dropped past that.
3. When the boutique confirms, rejects, ships, delivers or cancels the order,
   the server sends a push to every registered device, in the language the order
   was placed in, with `data: { reference, status, boutique }` so a tap can open
   the tracking screen.

A device that uninstalled the app is forgotten automatically. A failed push never
blocks the admin's action. The WhatsApp messages the admin can send are
unchanged: push is an addition. Server side, `EXPO_ACCESS_TOKEN` (optional) is
the Expo "enhanced push security" token.

If a customer reinstalls the app, they get their order back by tracking it with
the phone and reference; notifications then need a new `POST .../orders/push`.
