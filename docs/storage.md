# Images and Supabase Storage

## Buckets

| Bucket           | Public | Holds                                                                                      | Written by                                                      |
| ---------------- | ------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `product-images` | yes    | product photos (`products/<productId>/<uuid>.<ext>`), logos and hero images (`branding/…`) | admin Server Actions (`lib/actions/products.ts`, `settings.ts`) |
| `payment-proofs` | **no** | customers' payment screenshots (`orders/<uuid>.<ext>`)                                     | `placeOrder` (`lib/services/orders.ts`)                         |

Both are created by `pnpm run setup:supabase` (5 MB, PNG/JPEG/WebP only). Every
write goes through the server with the service role; the browser never talks to
Storage directly.

## Product images (public)

- **Written once, never overwritten.** Every upload gets a fresh path
  (`crypto.randomUUID()`); replacing a photo or a logo uploads a new object and
  removes the old one. That is what makes long caching safe.
- **Uploaded with `Cache-Control: max-age=31536000`** (`PUBLIC_IMAGE_CACHE_CONTROL`,
  `lib/image-config.ts`). Objects uploaded before that keep Supabase's default
  `max-age=3600`.
- **Resized in the browser before upload** (`lib/shop/compress-image.ts`):
  1600px WebP for products, 1920px for the hero, 512px for logos, falling back
  to JPEG (or PNG with transparency) where WebP can't be encoded, and to the
  original whenever that is smaller.
- **Shown through Vercel's image optimizer** (`next/image`), which keeps each
  optimized copy 31 days (`images.minimumCacheTTL`) and only asks for the widths
  in `DEVICE_SIZES` / `IMAGE_SIZES`. Each copy that is missing or expired makes
  Vercel download the original from Supabase: that is the **Cached Egress**.
- Link previews (`og:image`) and structured data point at a 1200px optimized
  copy (`optimizedImagePath`), not the original.
- Still direct from Supabase: the mobile app (`/api/v1` returns the public URL),
  the receipt and wallet logos (a few KB each).

## Payment proofs (private)

- The bucket is private: `…/object/public/payment-proofs/…` answers
  `Bucket not found`. Only the service role reads it.
- Only an admin page shows a proof: `app/[locale]/admin/(dashboard)/orders/[orderId]`.
  The page refuses anyone who isn't an admin of that boutique (`getAdminScope`,
  then `getOrderById(orderId, scope)`), then creates a **5-minute signed URL**
  (`getSignedPaymentProofUrl`). The database keeps only the object's path.
- Customers never get a proof back: tracking (website or app) returns the order,
  not the screenshot.
- Proofs are never re-encoded, resized or deleted by the app (except an upload
  whose order could not be created). The server checks the real format (magic
  bytes), the size (5 MB) and the pixel count.
- `next/image` can't fetch them: `remotePatterns` only allows
  `/storage/v1/object/public/**`, and signed URLs are `/object/sign/…`.

## Checks to run in the Supabase dashboard (SQL editor)

```sql
-- payment-proofs must say public = false
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- No policy should let anon or authenticated read payment-proofs
-- (no rows mentioning it is the expected result)
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```

## Measuring Cached Egress before and after

1. Supabase dashboard → **Project → Usage → Cached Egress**: note the daily
   values for a week before the change.
2. Deploy, then compare the same week-day values a week later. Cached Egress is
   reported per day; the first days after deploying include Vercel filling its
   new cache once.
3. Size of what is stored: `select bucket_id, count(*), sum((metadata->>'size')::bigint) / 1024 / 1024 as mb from storage.objects group by bucket_id;`
4. Headers of one image: `curl -sI <public url>` (`cache-control`) and
   `curl -sI "https://<site>/_next/image?url=<encoded url>&w=640&q=75"`
   (`cache-control: … max-age=2678400` once deployed).
