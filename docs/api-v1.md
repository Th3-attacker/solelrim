# Public API v1 (mobile app)

Base path: `/api/v1`. JSON in and out, no account and no token: a customer is
identified only by the phone number and order reference they give. Everything
the website's Server Actions already enforce (prices from the database, stock,
promo codes, payment-proof checks, rate limits, boutique licenses) applies here
too — the order and tracking routes call those same actions.

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
  `referenceCollision` 409, `uploadFailed` 502; any other business error 422.
- Catalogue `GET`s may be cached for 30 s; everything else is `no-store`.
- Money amounts are numbers in the boutique's currency (MRU).

## Routes
| Route | Purpose |
|---|---|
| `GET /boutiques` | Boutiques the customer can pick (closed ones are left out) |
| `GET /boutiques/{key}` | Branding, theme, payment details and wallets, social links, categories |
| `GET /boutiques/{key}/products?category=&q=&page=&pageSize=` | Catalogue page (`pageSize` ≤ 50, default 20) or search (`q`, rate-limited, one capped page) |
| `GET /boutiques/{key}/products/{slug}` | Product with images and variants (id, size, color, price, stock) |
| `POST /boutiques/{key}/stocks` `{ variantIds }` | Fresh stock for a saved cart: `{ stocks: { id: n } }`. A missing id no longer exists |
| `POST /boutiques/{key}/promo` `{ code, customerPhone, subtotal }` | Preview a promo code: `{ discountType, discountValue, discount }`. Not consumed until the order |
| `POST /boutiques/{key}/orders` (multipart) | Place an order → `201 { reference, orderId }` |
| `POST /boutiques/{key}/orders/track` `{ phone, reference }` | `{ reference, status, total, createdAt, statusSince }` |
| `POST` / `DELETE /boutiques/{key}/orders/push` `{ phone, reference, token }` | Start / stop push notifications for one order (see below) |

### Placing an order
`multipart/form-data` fields: `customerName`, `customerPhone` (8 digits,
starts with 2, 3 or 4), `customerCity`, `paymentSenderPhone` (same format),
`locale` (`fr|en|ar`, language of the messages sent about the order), `items`
(JSON string `[{"variantId":"…","quantity":1}]`), `promoCode` (optional),
`screenshot` (the payment proof, PNG/JPEG/WebP). The boutique is the one in the
URL; a `productType` field in the body is overridden.

```sh
curl -X POST https://<host>/api/v1/boutiques/sport/orders \
  -F customerName="Aïcha" -F customerPhone=37737353 -F customerCity=Nouakchott \
  -F paymentSenderPhone=37737353 -F locale=fr \
  -F 'items=[{"variantId":"<id>","quantity":1}]' \
  -F screenshot=@proof.png
```

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
